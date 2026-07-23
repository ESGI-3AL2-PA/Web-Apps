import { timingSafeEqual } from "crypto";
import { z } from "zod";
import type { ContractSignatureStatus } from "../entities/contract.entity.js";
import { logger } from "../logger.js";

// Service (couche services) : client léger au-dessus de l'API REST v1 de Documenso.
// Documenso tourne comme un service self-hosted séparé et possède l'UI de signature,
// les emails et le certificat ; on ne fait qu'orchestrer la création de document (à
// partir d'un template pré-configuré) et réagir à ses webhooks. Voir
// documentation/documenso-integration.md.
//
// L'API v1 est dépréciée-mais-supportée sous Documenso v2.x (elle sert encore chaque
// endpoint qu'on appelle) ; tout nouveau développement devrait cibler l'API v2.

export interface DocumensoParty {
  email: string;
  name: string;
}

export interface GeneratedContractDocument {
  documentId: number;
  providerSigningUrl: string | null;
  beneficiarySigningUrl: string | null;
}

/** Contrat du service Documenso, implémenté par le vrai client HTTP ou par le stand-in désactivé. */
export interface IDocumensoService {
  readonly enabled: boolean;
  // Génère un document de contrat signable à partir du template configuré, en assignant
  // le prestataire (provider) comme premier signataire et le bénéficiaire comme second.
  generateContractDocument(params: {
    title: string;
    provider: DocumensoParty;
    beneficiary: DocumensoParty;
    redirectUrl?: string;
  }): Promise<GeneratedContractDocument>;
  // Renvoie les emails d'invitation à signer pour un document.
  resendDocument(documentId: number): Promise<void>;
  // Supprime définitivement un document (utilisé pour l'effacement RGPD des contrats pending/draft).
  deleteDocument(documentId: number): Promise<void>;
  // Récupère les octets du PDF signé d'un document terminé ; null s'il n'est pas encore terminé.
  fetchSignedPdf(documentId: number): Promise<{ body: Buffer; contentType: string; filename: string } | null>;
  // Comparaison en temps constant de l'en-tête X-Documenso-Secret d'un webhook entrant.
  verifyWebhookSecret(received: string | undefined): boolean;
}

// DocumentStatus Documenso → notre statut de signature de contrat. Renvoie null pour
// tout statut non reconnu, afin qu'un événement inconnu/non géré soit ignoré plutôt
// que forcé dans un état "draft" (régressif).
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

// Corps d'un webhook Documenso entrant. Documenso envoie le document complet dans
// `payload` ; on ne lit que son id + statut, mais on valide l'enveloppe pour qu'un
// corps malformé/hostile soit rejeté avec un 400 avant d'atteindre le cas d'usage.
// `.passthrough()` conserve les nombreux champs document supplémentaires envoyés par
// Documenso sans faire échouer la validation.
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

// Clé stable identifiant une livraison logique unique, servant à écarter les rejeux.
// Documenso n'envoie pas d'en-tête d'id de livraison/événement unique : on en dérive
// une à partir du type d'événement + l'id du document + son statut ciblé — un renvoi du
// même événement terminal est ignoré.
export const documensoWebhookReplayKey = (event: DocumensoWebhookEvent): string =>
  `${event.event}:${event.payload?.id ?? ""}:${event.payload?.status ?? ""}`;

// Petite garde anti-rejeu en mémoire : mémorise les clés de livraison récemment traitées
// pendant un court TTL et les évince paresseusement. Défense en profondeur par-dessus les
// verrous de statut atomiques en aval — un événement rejoué est acquitté (200) sans être
// réappliqué. Mono-processus uniquement ; suffisant puisque les verrous en base rendent
// déjà le retraitement idempotent entre instances.
export class WebhookReplayCache {
  private readonly seen = new Map<string, number>();

  constructor(private readonly ttlMs: number = 5 * 60_000) {}

  private evict(now: number): void {
    for (const [key, expiresAt] of this.seen) {
      if (expiresAt <= now) this.seen.delete(key);
    }
  }

  // Vrai quand `key` a été enregistrée dans la fenêtre du TTL (i.e. c'est un rejeu).
  has(key: string): boolean {
    const now = Date.now();
    this.evict(now);
    return this.seen.has(key);
  }

  // Enregistre une clé comme traitée. À n'appeler qu'après un traitement réussi, afin
  // qu'un retry légitime d'une livraison ayant précédemment 500 soit encore retraité.
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
  // Hôtes que l'URL de téléchargement du PDF signé peut cibler (allowlist SSRF). Dérivés
  // de l'URL de base Documenso + du/des endpoint(s) de stockage objet configuré(s) pour l'api.
  downloadHosts: string[];
}

// Normalise un ensemble de chaînes URL-ou-hôte-nu (séparées par des virgules) en valeurs
// `host[:port]` en minuscules, en ignorant tout ce qui n'est pas parsable.
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

// Garde anti-SSRF pour le téléchargement du PDF signé : Documenso nous remet une
// `downloadUrl` (URL présignée du stockage objet, ou elle-même), qu'un Documenso
// compromis/mal configuré pourrait pointer vers une adresse interne. On rejette tout
// ce qui n'est pas du http(s) vers un hôte de l'allowlist.
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

// Une valeur n'est "définie" que si elle est non vide et n'est pas un placeholder
// d'échafaudage — les templates `.env.dist` / SOPS embarquent des marqueurs `TODO-…`, et
// les traiter comme configurés construirait un vrai client qui 502 au premier appel amont
// au lieu de retomber sur le stand-in désactivé (qui échoue bruyamment au boot). On trim
// d'abord pour qu'un espace parasite ne compte pas comme configuré.
const configured = (value: string | undefined): string | undefined => {
  const trimmed = value?.trim();
  if (!trimmed || /^todo\b/i.test(trimmed)) return undefined;
  return trimmed;
};

export const readConfig = (): DocumensoConfig | null => {
  const baseUrl = configured(process.env.DOCUMENSO_URL);
  const apiToken = configured(process.env.DOCUMENSO_API_TOKEN);
  const templateIdRaw = configured(process.env.DOCUMENSO_TEMPLATE_ID);
  if (!baseUrl || !apiToken || !templateIdRaw) return null;
  // Un template id non numérique (ex. le placeholder `TODO-numeric-template-id`)
  // deviendrait NaN et appellerait silencieusement `/templates/NaN` ; on le traite
  // plutôt comme non configuré.
  const templateId = Number(templateIdRaw);
  if (!Number.isFinite(templateId)) {
    logger.warn(`DOCUMENSO_TEMPLATE_ID is not a number ("${templateIdRaw}") — Documenso disabled.`);
    return null;
  }
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, "");
  return {
    baseUrl: normalizedBaseUrl,
    apiToken,
    templateId,
    webhookSecret: process.env.DOCUMENSO_WEBHOOK_SECRET ?? "",
    signingLanguage: process.env.DOCUMENSO_SIGNING_LANGUAGE ?? "fr",
    // On autorise l'hôte Documenso lui-même, le(s) endpoint(s) de stockage objet que l'api
    // connaît déjà (Documenso présigne ses URL de téléchargement contre son endpoint
    // d'upload S3/MinIO), et un override explicite pour les déploiements dont le stockage
    // objet diffère de ceux-là.
    downloadHosts: collectHosts(
      normalizedBaseUrl,
      process.env.DOCUMENSO_DOWNLOAD_HOSTS,
      process.env.MESSAGES_MINIO_ENDPOINT ?? "http://localhost:9000",
      process.env.LISTINGS_MINIO_ENDPOINT,
    ),
  };
};

// Budget d'appel amont Documenso — borne la création de contrat afin qu'un Documenso
// ou un S3 bloqué ne fige pas la requête indéfiniment.
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
      // Échec réseau ou timeout — on normalise pour que les appelants le mappent en 502.
      const reason = err instanceof Error ? err.message : "unknown error";
      throw new DocumensoServiceError(`Documenso ${init?.method ?? "GET"} ${path} unreachable: ${reason}`);
    }
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new DocumensoServiceError(`Documenso ${init?.method ?? "GET"} ${path} failed (${res.status}): ${body}`);
    }
    // Certains endpoints (resend) renvoient un corps vide.
    const text = await res.text();
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // Résout les deux placeholders de signataire du template, ordonnés de sorte que
  // l'index 0 soit le prestataire et l'index 1 le bénéficiaire (par signingOrder, puis id).
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

    // generate-document laisse le document en DRAFT ; l'envoyer active les tokens de
    // signature des destinataires et déclenche les emails d'invitation. Si l'envoi
    // échoue, on supprime le draft orphelin pour qu'une création ratée ne laisse rien.
    try {
      await this.request(`/documents/${result.documentId}/send`, {
        method: "POST",
        body: JSON.stringify({}),
      });
    } catch (err) {
      await this.request(`/documents/${result.documentId}`, { method: "DELETE" }).catch(() => {});
      throw err;
    }

    // On réassocie les URL de signature renvoyées à chaque partie via l'email.
    const urlFor = (email: string) =>
      result.recipients?.find((r) => r.email.toLowerCase() === email.toLowerCase())?.signingUrl ?? null;

    return {
      documentId: result.documentId,
      providerSigningUrl: urlFor(params.provider.email),
      beneficiarySigningUrl: urlFor(params.beneficiary.email),
    };
  }

  async resendDocument(documentId: number): Promise<void> {
    // Le resend de Documenso cible des destinataires précis par id — une liste vide
    // n'envoie à personne. On récupère le document et on ré-invite chaque signataire
    // qui n'a pas encore signé (repli sur tous les signataires si le champ statut manque).
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
      // Documenso renvoie 400 pour un document pas encore terminé ; on traite ça comme
      // "pas encore de PDF signé".
      if (err instanceof DocumensoServiceError && /not completed/i.test(err.message)) return null;
      throw err;
    }
    // L'api tourne sur le même réseau docker que le stockage objet de Documenso, donc
    // l'hôte de l'URL présignée est directement joignable. On le valide d'abord contre
    // l'allowlist configurée pour qu'un Documenso compromis/mal configuré ne puisse pas
    // nous rediriger vers une adresse interne (SSRF).
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

// Stand-in désactivé utilisé quand l'env Documenso n'est pas configuré — chaque appel
// échoue bruyamment afin que des contrats ne puissent pas être créés silencieusement
// sans document signable.
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
    // No-op quand Documenso n'est pas configuré — rien à effacer côté distant, et la
    // suppression de compte ne doit pas échouer juste parce que la stack e-signature ne
    // tourne pas.
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
  // Sans lui, chaque webhook entrant est rejeté (fail-closed), et les contrats ne
  // dépasseraient jamais l'état "pending". On avertit bruyamment plutôt que d'échouer
  // en silence.
  logger.warn(
    "DOCUMENSO_WEBHOOK_SECRET is not set — signing webhooks will be rejected and contracts will stay pending.",
  );
}
export const documensoService: IDocumensoService = config
  ? new HttpDocumensoService(config)
  : new DisabledDocumensoService();
