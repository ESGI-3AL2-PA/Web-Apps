import { timingSafeEqual } from "crypto";
import { z } from "zod";
import type { ContractSignatureStatus } from "../entities/contract.entity.js";
import { logger } from "../logger.js";

// Thin client over the Documenso v1 REST API. Documenso runs as a separate
// self-hosted service and owns the signing UI, emails, and certificate; we only
// orchestrate document creation (from a pre-configured template) and react to
// its webhooks. See documentation/documenso-integration.md.

export interface DocumensoParty {
  email: string;
  name: string;
}

export interface GeneratedContractDocument {
  documentId: number;
  providerSigningUrl: string | null;
  beneficiarySigningUrl: string | null;
}

export interface IDocumensoService {
  readonly enabled: boolean;
  // Generate a signable contract document from the configured template, assigning
  // the provider as the first signer and the beneficiary as the second.
  generateContractDocument(params: {
    title: string;
    provider: DocumensoParty;
    beneficiary: DocumensoParty;
    redirectUrl?: string;
  }): Promise<GeneratedContractDocument>;
  // Re-send the signing invitation emails for a document.
  resendDocument(documentId: number): Promise<void>;
  // Permanently delete a document (used for GDPR erasure of pending/draft contracts).
  deleteDocument(documentId: number): Promise<void>;
  // Fetch the signed PDF bytes for a completed document; null if not completed yet.
  fetchSignedPdf(documentId: number): Promise<{ body: Buffer; contentType: string; filename: string } | null>;
  // Constant-time comparison of an inbound webhook's X-Documenso-Secret header.
  verifyWebhookSecret(received: string | undefined): boolean;
}

// Documenso DocumentStatus → our contract signature status. Returns null for any
// status we don't recognise, so an unknown/unhandled event is ignored rather than
// coerced into a (regressive) "draft" state.
export const mapDocumensoStatus = (status: string | undefined): ContractSignatureStatus | null => {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "REJECTED":
      return "rejected";
    case "PENDING":
      return "pending";
    case "DRAFT":
      return "draft";
    default:
      return null;
  }
};

// Inbound Documenso webhook body. Documenso sends the full document in `payload`; we
// only read its id + status, but validate the envelope so a malformed/hostile body is
// rejected with a 400 before it reaches the use-case. `.passthrough()` keeps the many
// extra document fields Documenso sends without failing validation on them.
export const documensoWebhookEventSchema = z
  .object({
    event: z.string().min(1),
    payload: z
      .object({
        id: z.number().optional(),
        status: z.string().optional(),
      })
      .passthrough()
      .optional(),
  })
  .passthrough();

export type DocumensoWebhookEvent = z.infer<typeof documensoWebhookEventSchema>;

// Stable key identifying a single logical delivery, used to drop replays. Documenso does
// not send a unique delivery/event id header, so we derive one from the event type plus
// the document id + status it targets — a re-post of the same terminal event is ignored.
export const documensoWebhookReplayKey = (event: DocumensoWebhookEvent): string =>
  `${event.event}:${event.payload?.id ?? ""}:${event.payload?.status ?? ""}`;

// Small in-memory replay guard: remembers recently-processed delivery keys for a short
// TTL and evicts lazily. Defense-in-depth on top of the downstream atomic status gates —
// a replayed event is acknowledged (200) without being re-applied. Single-process only;
// good enough given the DB gates already make re-processing idempotent across instances.
export class WebhookReplayCache {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number = 5 * 60_000) {}

  private evict(now: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
  }

  // True when `key` was recorded within the TTL (i.e. this is a replay).
  has(key: string): boolean {
    const now = Date.now();
    this.evict(now);
    return this.seen.has(key);
  }

  // Record a key as processed. Call only after successful handling so a legitimate retry
  // of a delivery that previously 500'd is still reprocessed.
  remember(key: string): void {
    this.seen.set(key, Date.now() + this.ttlMs);
  }
}

export const documensoWebhookReplayCache = new WebhookReplayCache();

interface DocumensoConfig {
  baseUrl: string;
  apiToken: string;
  templateId: number;
  webhookSecret: string;
  signingLanguage: string;
  // Hosts the signed-PDF download URL may point at (SSRF allowlist). Derived from the
  // Documenso base URL + the object-store endpoint(s) the api is configured with.
  downloadHosts: string[];
}

// Normalise a set of URL-or-bare-host strings (comma-separated allowed) to lowercase
// `host[:port]` values, ignoring anything unparseable.
const collectHosts = (...values: Array<string | undefined>): string[] => {
  const hosts = new Set<string>();
  for (const value of values) {
    if (!value) continue;
    for (const part of value.split(",")) {
      const trimmed = part.trim();
      if (!trimmed) continue;
      try {
        hosts.add(new URL(trimmed).host.toLowerCase());
      } catch {
        hosts.add(trimmed.toLowerCase());
      }
    }
  }
  return [...hosts];
};

// SSRF guard for the signed-PDF download: Documenso hands us a `downloadUrl` (a presigned
// object-store URL, or itself), which a compromised/misconfigured Documenso could point at
// an internal address. Reject anything that isn't http(s) to an allowlisted host.
export const assertAllowedDownloadUrl = (rawUrl: string, allowedHosts: readonly string[]): URL => {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new DocumensoServiceError("Documenso returned a malformed signed-PDF download URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new DocumensoServiceError(`Refusing signed-PDF download over unsupported scheme "${url.protocol}"`);
  }
  if (!allowedHosts.includes(url.host.toLowerCase())) {
    throw new DocumensoServiceError(`Refusing signed-PDF download from non-allowlisted host "${url.host}"`);
  }
  return url;
};

const readConfig = (): DocumensoConfig | null => {
  const baseUrl = process.env.DOCUMENSO_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;
  const templateId = process.env.DOCUMENSO_TEMPLATE_ID;
  if (!baseUrl || !apiToken || !templateId) return null;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return {
    baseUrl: normalizedBaseUrl,
    apiToken,
    templateId: Number(templateId),
    webhookSecret: process.env.DOCUMENSO_WEBHOOK_SECRET ?? "",
    signingLanguage: process.env.DOCUMENSO_SIGNING_LANGUAGE ?? "fr",
    // Allow the Documenso host itself, the object-store endpoint(s) the api already knows
    // (Documenso presigns download URLs against its S3/MinIO upload endpoint), and an
    // explicit override for deployments whose object store differs from those.
    downloadHosts: collectHosts(
      normalizedBaseUrl,
      process.env.DOCUMENSO_DOWNLOAD_HOSTS,
      process.env.MESSAGES_MINIO_ENDPOINT ?? "http://localhost:9000",
      process.env.LISTINGS_MINIO_ENDPOINT,
    ),
  };
};

// Upstream Documenso call budget — bounds contract creation so a hung Documenso
// or S3 can't stall the request indefinitely.
const DOCUMENSO_TIMEOUT_MS = 15_000;

export class DocumensoServiceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DocumensoServiceError";
  }
}

class HttpDocumensoService implements IDocumensoService {
  constructor(private readonly config: DocumensoConfig) {}

  get enabled(): boolean {
    return true;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    let res: Response;
    try {
      res = await fetch(`${this.config.baseUrl}/api/v1${path}`, {
        ...init,
        signal: AbortSignal.timeout(DOCUMENSO_TIMEOUT_MS),
        headers: {
          Authorization: this.config.apiToken,
          "Content-Type": "application/json",
          ...init?.headers,
        },
      });
    } catch (err) {
      // Network failure or timeout — normalise so callers map it to a 502.
      const reason = err instanceof Error ? err.message : "unknown error";
      throw new DocumensoServiceError(`Documenso ${init?.method ?? "GET"} ${path} unreachable: ${reason}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DocumensoServiceError(`Documenso ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
    }
    // Some endpoints (resend) return empty bodies.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // Resolve the template's two signer placeholders, ordered so index 0 is the
  // provider and index 1 the beneficiary (by signingOrder, then id).
  private async templateSignerIds(): Promise<[number, number]> {
    const template = await this.request<{
      recipients?: Array<{ id: number; role?: string; signingOrder?: number | null }>;
    }>(`/templates/${this.config.templateId}`);
    const signers = (template.recipients ?? [])
      .filter((r) => (r.role ?? "SIGNER") === "SIGNER")
      .sort((a, b) => (a.signingOrder ?? 0) - (b.signingOrder ?? 0) || a.id - b.id);
    if (signers.length < 2) {
      throw new DocumensoServiceError(
        `Documenso template ${this.config.templateId} must define at least 2 SIGNER recipients (found ${signers.length})`,
      );
    }
    return [signers[0]!.id, signers[1]!.id];
  }

  async generateContractDocument(params: {
    title: string;
    provider: DocumensoParty;
    beneficiary: DocumensoParty;
    redirectUrl?: string;
  }): Promise<GeneratedContractDocument> {
    const [providerSignerId, beneficiarySignerId] = await this.templateSignerIds();

    const result = await this.request<{
      documentId: number;
      recipients?: Array<{ recipientId: number; email: string; signingUrl?: string }>;
    }>(`/templates/${this.config.templateId}/generate-document`, {
      method: "POST",
      body: JSON.stringify({
        title: params.title,
        recipients: [
          { id: providerSignerId, email: params.provider.email, name: params.provider.name },
          { id: beneficiarySignerId, email: params.beneficiary.email, name: params.beneficiary.name },
        ],
        meta: {
          distributionMethod: "EMAIL",
          language: this.config.signingLanguage,
          ...(params.redirectUrl ? { redirectUrl: params.redirectUrl } : {}),
        },
      }),
    });

    // generate-document leaves the document in DRAFT; sending it activates the
    // recipients' signing tokens and dispatches the invitation emails. If sending
    // fails, delete the orphaned draft so a failed create leaves nothing behind.
    try {
      await this.request(`/documents/${result.documentId}/send`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (err) {
      await this.request(`/documents/${result.documentId}`, { method: "DELETE" }).catch(() => {});
      throw err;
    }

    // Match the returned signing URLs back to each party by email.
    const urlFor = (email: string) =>
      result.recipients?.find((r) => r.email.toLowerCase() === email.toLowerCase())?.signingUrl ?? null;

    return {
      documentId: result.documentId,
      providerSigningUrl: urlFor(params.provider.email),
      beneficiarySigningUrl: urlFor(params.beneficiary.email),
    };
  }

  async resendDocument(documentId: number): Promise<void> {
    // Documenso's resend targets specific recipients by id — an empty list mails
    // nobody. Fetch the document and re-invite every signer who hasn't signed yet
    // (fall back to all signers if the status field is absent).
    const doc = await this.request<{
      recipients?: Array<{ id: number; role?: string; signingStatus?: string }>;
    }>(`/documents/${documentId}`);
    const signers = (doc.recipients ?? []).filter((r) => (r.role ?? "SIGNER") === "SIGNER");
    const pending = signers.filter((r) => (r.signingStatus ?? "NOT_SIGNED").toUpperCase() !== "SIGNED");
    const recipients = (pending.length > 0 ? pending : signers).map((r) => r.id);
    await this.request(`/documents/${documentId}/resend`, {
      method: "POST",
      body: JSON.stringify({ recipients }),
    });
  }

  async deleteDocument(documentId: number): Promise<void> {
    await this.request(`/documents/${documentId}`, { method: "DELETE" });
  }

  async fetchSignedPdf(documentId: number): Promise<{ body: Buffer; contentType: string; filename: string } | null> {
    let meta: { downloadUrl: string; filename?: string; contentType?: string };
    try {
      meta = await this.request(`/documents/${documentId}/download?version=signed`);
    } catch (err) {
      // Documenso 400s a not-yet-completed document; treat as "no signed PDF yet".
      if (err instanceof DocumensoServiceError && /not completed/i.test(err.message)) return null;
      throw err;
    }
    // The api runs on the same docker network as Documenso's object storage, so the
    // presigned URL host is directly reachable. Validate it against the configured
    // allowlist first so a compromised/misconfigured Documenso can't redirect us at an
    // internal address (SSRF).
    const downloadUrl = assertAllowedDownloadUrl(meta.downloadUrl, this.config.downloadHosts);
    const res = await fetch(downloadUrl, { signal: AbortSignal.timeout(DOCUMENSO_TIMEOUT_MS) });
    if (!res.ok) {
      throw new DocumensoServiceError(`Documenso S3 download failed (${res.status})`);
    }
    return {
      body: Buffer.from(await res.arrayBuffer()),
      contentType: meta.contentType || "application/pdf",
      filename: meta.filename || `contrat-${documentId}.pdf`,
    };
  }

  verifyWebhookSecret(received: string | undefined): boolean {
    const expected = this.config.webhookSecret;
    if (!expected || !received) return false;
    const a = Buffer.from(expected);
    const b = Buffer.from(received);
    return a.length === b.length && timingSafeEqual(a, b);
  }
}

// Disabled stand-in used when Documenso env is not configured — every call fails
// loudly so contracts can't be silently created without a signable document.
class DisabledDocumensoService implements IDocumensoService {
  get enabled(): boolean {
    return false;
  }
  private fail(): never {
    throw new DocumensoServiceError(
      "Documenso is not configured — set DOCUMENSO_URL, DOCUMENSO_API_TOKEN and DOCUMENSO_TEMPLATE_ID",
    );
  }
  async generateContractDocument(): Promise<GeneratedContractDocument> {
    this.fail();
  }
  async resendDocument(): Promise<void> {
    this.fail();
  }
  async deleteDocument(): Promise<void> {
    // No-op when Documenso is unconfigured — nothing to erase remotely, and account
    // deletion must not fail just because the e-signature stack isn't running.
  }
  async fetchSignedPdf(): Promise<{ body: Buffer; contentType: string; filename: string } | null> {
    return null;
  }
  verifyWebhookSecret(): boolean {
    return false;
  }
}

const config = readConfig();
if (config && !config.webhookSecret) {
  // Without it every inbound webhook is rejected (fail-closed), so contracts would
  // never advance past "pending". Warn loudly rather than fail silently.
  logger.warn(
    "DOCUMENSO_WEBHOOK_SECRET is not set — signing webhooks will be rejected and contracts will stay pending.",
  );
}
export const documensoService: IDocumensoService = config
  ? new HttpDocumensoService(config)
  : new DisabledDocumensoService();
