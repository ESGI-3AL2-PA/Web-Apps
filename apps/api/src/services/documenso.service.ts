import { timingSafeEqual } from "crypto";
import type { ContractSignatureStatus } from "../entities/contract.entity.js";

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
  // Fetch the signed PDF bytes for a completed document; null if not completed yet.
  fetchSignedPdf(documentId: number): Promise<{ body: Buffer; contentType: string; filename: string } | null>;
  // Constant-time comparison of an inbound webhook's X-Documenso-Secret header.
  verifyWebhookSecret(received: string | undefined): boolean;
}

// Documenso DocumentStatus → our contract signature status.
export const mapDocumensoStatus = (status: string | undefined): ContractSignatureStatus => {
  switch (status) {
    case "COMPLETED":
      return "completed";
    case "REJECTED":
      return "rejected";
    case "PENDING":
      return "pending";
    default:
      return "draft";
  }
};

interface DocumensoConfig {
  baseUrl: string;
  apiToken: string;
  templateId: number;
  webhookSecret: string;
  signingLanguage: string;
}

const readConfig = (): DocumensoConfig | null => {
  const baseUrl = process.env.DOCUMENSO_URL;
  const apiToken = process.env.DOCUMENSO_API_TOKEN;
  const templateId = process.env.DOCUMENSO_TEMPLATE_ID;
  if (!baseUrl || !apiToken || !templateId) return null;
  return {
    baseUrl: baseUrl.replace(/\/+$/, ""),
    apiToken,
    templateId: Number(templateId),
    webhookSecret: process.env.DOCUMENSO_WEBHOOK_SECRET ?? "",
    signingLanguage: process.env.DOCUMENSO_SIGNING_LANGUAGE ?? "fr",
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
    await this.request(`/documents/${documentId}/resend`, {
      method: "POST",
      body: JSON.stringify({ recipients: [] }),
    });
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
    // presigned URL host is directly reachable — a plain fetch suffices.
    const res = await fetch(meta.downloadUrl, { signal: AbortSignal.timeout(DOCUMENSO_TIMEOUT_MS) });
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
  console.warn(
    "[documenso] DOCUMENSO_WEBHOOK_SECRET is not set — signing webhooks will be rejected and contracts will stay pending.",
  );
}
export const documensoService: IDocumensoService = config
  ? new HttpDocumensoService(config)
  : new DisabledDocumensoService();
