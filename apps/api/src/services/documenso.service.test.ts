// Suite de tests (couche services) du client Documenso : couvre la garde de
// configuration par variables d'env (readConfig), le mapping des statuts, la garde
// SSRF sur l'URL de téléchargement du PDF signé, la validation du corps de webhook
// entrant et le cache anti-rejeu (replay) des webhooks.
import { afterEach, describe, expect, it } from "vitest";
import {
  assertAllowedDownloadUrl,
  documensoWebhookEventSchema,
  documensoWebhookReplayKey,
  mapDocumensoStatus,
  readConfig,
  WebhookReplayCache,
} from "./documenso.service.js";

// readConfig ne construit une config que si les trois variables d'env sont de vraies
// valeurs (ni placeholder TODO, ni template id non numérique).
describe("readConfig (Documenso env guard)", () => {
  const KEYS = ["DOCUMENSO_URL", "DOCUMENSO_API_TOKEN", "DOCUMENSO_TEMPLATE_ID"] as const;
  // Sauvegarde/restaure l'environnement autour de chaque test pour ne pas fuiter d'état.
  const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
  const set = (url?: string, token?: string, templateId?: string) => {
    const vals = { DOCUMENSO_URL: url, DOCUMENSO_API_TOKEN: token, DOCUMENSO_TEMPLATE_ID: templateId };
    for (const k of KEYS) {
      if (vals[k] === undefined) delete process.env[k];
      else process.env[k] = vals[k];
    }
  };

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  // Trois vraies valeurs → config valide, avec le slash final de l'URL retiré.
  it("builds a config when all three vars are real values", () => {
    set("https://documenso.example.com/", "api_token_abc", "42");
    const config = readConfig();
    expect(config).not.toBeNull();
    expect(config?.templateId).toBe(42);
    expect(config?.baseUrl).toBe("https://documenso.example.com"); // trailing slash trimmed
  });

  // Les placeholders TODO du template .env.dist comptent comme non configuré → null.
  it("returns null when the scaffolding TODO placeholders are left in place", () => {
    set("https://documenso.example.com", "TODO-from-documenso-ui", "TODO-numeric-template-id");
    expect(readConfig()).toBeNull();
  });

  // Un template id non numérique deviendrait NaN → on renvoie null plutôt que d'appeler /templates/NaN.
  it("returns null for a non-numeric template id rather than hitting /templates/NaN", () => {
    set("https://documenso.example.com", "api_token_abc", "not-a-number");
    expect(readConfig()).toBeNull();
  });

  // Toute variable requise absente ou vide (espaces seuls) → null.
  it("returns null when any required var is unset or blank", () => {
    set(undefined, "api_token_abc", "42");
    expect(readConfig()).toBeNull();
    set("https://documenso.example.com", "   ", "42");
    expect(readConfig()).toBeNull();
  });
});

// mapDocumensoStatus traduit un DocumentStatus Documenso vers notre statut de signature.
describe("mapDocumensoStatus", () => {
  // Chaque statut connu est mappé sur son équivalent contrat.
  it("maps every known Documenso status to its contract status", () => {
    expect(mapDocumensoStatus("COMPLETED")).toBe("completed");
    expect(mapDocumensoStatus("REJECTED")).toBe("rejected");
    expect(mapDocumensoStatus("PENDING")).toBe("pending");
    expect(mapDocumensoStatus("DRAFT")).toBe("draft");
  });

  // Statut inconnu (ou mauvaise casse) → null, l'événement est ignoré plutôt que forcé en "draft".
  it("returns null for an unknown status so the event is ignored, not coerced to draft", () => {
    expect(mapDocumensoStatus("SOMETHING_NEW")).toBeNull();
    expect(mapDocumensoStatus("completed")).toBeNull(); // case-sensitive
    expect(mapDocumensoStatus(undefined)).toBeNull();
  });
});

// assertAllowedDownloadUrl : garde anti-SSRF sur l'URL de téléchargement du PDF signé.
describe("assertAllowedDownloadUrl (SSRF guard)", () => {
  const allowed = ["minio:9000", "documenso:3030"];

  // Un http(s) vers un hôte de l'allowlist est accepté, l'URL parsée est renvoyée.
  it("accepts an http(s) URL on an allowlisted host and returns the parsed URL", () => {
    const url = assertAllowedDownloadUrl("http://minio:9000/documenso/signed.pdf?X-Amz-Signature=abc", allowed);
    expect(url.host).toBe("minio:9000");
  });

  // Un hôte hors allowlist est rejeté (ex. adresse interne de métadonnées cloud).
  it("rejects a host that is not on the allowlist (SSRF to internal address)", () => {
    expect(() => assertAllowedDownloadUrl("http://169.254.169.254/latest/meta-data", allowed)).toThrow(
      /non-allowlisted host/,
    );
  });

  // Même un hôte autorisé est rejeté si le schéma n'est pas http(s) (ex. file://).
  it("rejects an allowlisted host reached over a non-http(s) scheme", () => {
    expect(() => assertAllowedDownloadUrl("file:///etc/passwd", allowed)).toThrow(/unsupported scheme/);
  });

  // Une URL malformée est rejetée.
  it("rejects a malformed URL", () => {
    expect(() => assertAllowedDownloadUrl("not a url", allowed)).toThrow(/malformed/);
  });
});

// documensoWebhookEventSchema valide l'enveloppe d'un webhook entrant (passthrough sur les champs extra).
describe("documensoWebhookEventSchema", () => {
  // Un événement bien formé passe et conserve les champs document supplémentaires.
  it("accepts a well-formed event and keeps extra document fields", () => {
    const parsed = documensoWebhookEventSchema.safeParse({
      event: "DOCUMENT_COMPLETED",
      payload: { id: 42, status: "COMPLETED", title: "Contract" },
    });
    expect(parsed.success).toBe(true);
    expect(parsed.success && parsed.data.payload?.id).toBe(42);
  });

  // Un corps sans champ `event` est rejeté.
  it("rejects a body missing the event field", () => {
    expect(documensoWebhookEventSchema.safeParse({ payload: { id: 1 } }).success).toBe(false);
  });

  // Un payload dont l'id n'est pas un nombre est rejeté.
  it("rejects a payload whose id is not a number", () => {
    expect(documensoWebhookEventSchema.safeParse({ event: "DOCUMENT_COMPLETED", payload: { id: "42" } }).success).toBe(
      false,
    );
  });
});

// WebhookReplayCache : garde anti-rejeu en mémoire, avec expiration par TTL.
describe("WebhookReplayCache", () => {
  const key = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 7, status: "COMPLETED" } });

  // Une clé jamais vue n'est pas signalée, puis l'est une fois mémorisée.
  it("does not flag an unseen key, then flags it once remembered", () => {
    const cache = new WebhookReplayCache();
    expect(cache.has(key)).toBe(false);
    cache.remember(key);
    expect(cache.has(key)).toBe(true);
  });

  // Une entrée est évincée une fois son TTL écoulé.
  it("evicts an entry once its TTL has elapsed", () => {
    const cache = new WebhookReplayCache(-1); // TTL déjà expiré
    cache.remember(key);
    expect(cache.has(key)).toBe(false);
  });

  // Des documents / statuts différents produisent des clés distinctes.
  it("derives distinct keys for different documents / statuses", () => {
    const a = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 1, status: "COMPLETED" } });
    const b = documensoWebhookReplayKey({ event: "DOCUMENT_COMPLETED", payload: { id: 2, status: "COMPLETED" } });
    expect(a).not.toBe(b);
  });
});
