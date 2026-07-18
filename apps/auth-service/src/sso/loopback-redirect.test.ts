import { describe, expect, it } from "vitest";
import { isAllowedLoopbackRedirect } from "./loopback-redirect.js";

describe("isAllowedLoopbackRedirect", () => {
  it("accepts loopback callbacks on an arbitrary port", () => {
    // The ephemeral-port requirement (RFC 8252 §7.3) — CallbackServer binds :0.
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:54321/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:1/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:65535/callback")).toBe(true);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1/callback")).toBe(true);
  });

  it("accepts the bracketed IPv6 loopback", () => {
    expect(isAllowedLoopbackRedirect("http://[::1]:54321/callback")).toBe(true);
  });

  it("normalises obfuscated spellings of 127.0.0.1 rather than being fooled by them", () => {
    // URL parsing turns octal into dotted-quad, so this really is loopback.
    expect(isAllowedLoopbackRedirect("http://0177.0.0.1:5/callback")).toBe(true);
  });

  it("rejects non-loopback hosts", () => {
    expect(isAllowedLoopbackRedirect("http://evil.example.com/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.1.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://10.0.0.1:5/callback")).toBe(false);
  });

  it("rejects localhost — it is name-resolved and can be repointed", () => {
    expect(isAllowedLoopbackRedirect("http://localhost:54321/callback")).toBe(false);
  });

  it("rejects a userinfo prefix pointing at a foreign host", () => {
    expect(isAllowedLoopbackRedirect("http://evil.example.com@127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://user:pass@127.0.0.1:5/callback")).toBe(false);
  });

  it("rejects any path other than /callback", () => {
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/cb")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback/extra")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback/../evil")).toBe(false);
  });

  it("rejects a pre-seeded query or fragment", () => {
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback?x=1")).toBe(false);
    expect(isAllowedLoopbackRedirect("http://127.0.0.1:5/callback#frag")).toBe(false);
  });

  it("rejects non-http schemes", () => {
    expect(isAllowedLoopbackRedirect("https://127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("javascript:alert(1)//127.0.0.1/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("file:///callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("data:text/html,callback")).toBe(false);
  });

  it("rejects unparseable, empty, relative and oversized input", () => {
    expect(isAllowedLoopbackRedirect("")).toBe(false);
    expect(isAllowedLoopbackRedirect("not a url")).toBe(false);
    expect(isAllowedLoopbackRedirect("/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect("//127.0.0.1:5/callback")).toBe(false);
    expect(isAllowedLoopbackRedirect(`http://127.0.0.1:5/callback?${"a".repeat(600)}`)).toBe(false);
  });
});
