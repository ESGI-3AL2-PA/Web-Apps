/**
 * Suite de tests de la politique de redirect_uri du SSO desktop.
 *
 * Verrouille la frontière anti-open-redirect : seuls les callbacks loopback exacts
 * (127.0.0.1 / [::1], chemin /callback, http, port quelconque, ni query/fragment/userinfo)
 * sont acceptés ; tout le reste (localhost, hôtes étrangers, formes obfusquées, autres
 * schémas, entrées surdimensionnées) est refusé.
 */
import { describe, expect, it } from "vitest";
import { isAllowedLoopbackRedirect } from "./loopback-redirect.js";

describe("isAllowedLoopbackRedirect", () => {
  // Accepte le loopback sur n'importe quel port, y compris sans port explicite.
  it("accepts loopback callbacks on an arbitrary port", () => {
    // L'exigence de port éphémère (RFC 8252 §7.3) — CallbackServer bind sur :0.
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:54321/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:1/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:65535/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1/callback")).toBe(true);
  });

  // Accepte le loopback IPv6 entre crochets ([::1]).
  it("accepts the bracketed IPv6 loopback", () => {
    expect(isAllowedLoopbackRedirect("http://[::1]:54321/callback")).toBe(true);
  });

  // Normalise les écritures obfusquées de 127.0.0.1 au lieu de se laisser tromper.
  it("normalises obfuscated spellings of 127.0.0.1 rather than being fooled by them", () => {
    // Le parseur d'URL convertit l'octal en dotted-quad : c'est donc bien du loopback.
    expect(isAllowedLoopbackRedirect("http://0177.0.0.1:5/callback")).toBe(true);
  });

  // Refuse les hôtes non-loopback (domaine externe, IP proche mais différente, IP privée).
  it("rejects non-loopback hosts", () => {
    expect(isAllowedLoopbackRedirect("http://evil.example.com/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.1.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://10.0.0.1:5/callback")).toBe(false);
  });

  // Refuse localhost — résolu par nom, donc redirigeable via hosts-file ou DNS.
  it("rejects localhost — it is name-resolved and can be repointed", () => {
    expect(isAllowedLoopbackRedirect("http://localhost:54321/callback")).toBe(false);
  });

  // Refuse un préfixe userinfo pointant vers un hôte étranger (piège « http://evil@127.0.0.1 »).
  it("rejects a userinfo prefix pointing at a foreign host", () => {
    expect(isAllowedLoopbackRedirect("http://evil.example.com@127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://user:pass@127.0.0.1:5/callback")).toBe(false);
  });

  // Refuse tout chemin autre que /callback exact (pas de préfixe, pas de traversée).
  it("rejects any path other than /callback", () => {
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/cb")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback/extra")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback/../evil")).toBe(false);
  });

  // Refuse une query ou un fragment pré-remplis (ils entreraient en collision avec code/state).
  it("rejects a pre-seeded query or fragment", () => {
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback?x=1")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback#frag")).toBe(false);
  });

  // Refuse les schémas non-http (https, javascript:, file:, data:).
  it("rejects non-http schemes", () => {
    expect(isAllowedLoopbackRedirect("https://127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("javascript:alert(1)//127.0.0.1/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("file:///callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("data:text/html,callback")).toBe(false);
  });

  // Refuse les entrées non parsables, vides, relatives ou surdimensionnées (> MAX_LENGTH).
  it("rejects unparseable, empty, relative and oversized input", () => {
    expect(isAllowedLoopbackRedirect("")).toBe(false);
    expect(isAllowedLoopbackRedirect("not a url")).toBe(false);
    expect(isAllowedLoopbackRedirect("/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("//127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect(`http://127.0.0.1:5/callback?${"a".repeat(600)}`)).toBe(false);
  });
});
