import { describe, expect, it } from "vitest";
import { passwordResetTemplates, verificationTemplates } from "./email.service.js";

const LINK = "https://example.test/link?token=abc";

describe("email templates i18n", () => {
  it("selects the English verification template", () => {
    const { subject, text, html } = verificationTemplates.en(LINK);
    expect(subject).toContain("Verify your");
    expect(text).toContain("Welcome to");
    expect(html).toContain(LINK);
  });

  it("selects the French verification template", () => {
    const { subject, text, html } = verificationTemplates.fr(LINK);
    expect(subject).toContain("Vérifiez votre compte");
    expect(text).toContain("Bienvenue sur");
    expect(html).toContain(LINK);
  });

  it("selects the English password-reset template", () => {
    const { subject, text } = passwordResetTemplates.en(LINK);
    expect(subject).toContain("Reset your");
    expect(text).toContain("A password reset was requested");
  });

  it("selects the French password-reset template", () => {
    const { subject, text } = passwordResetTemplates.fr(LINK);
    expect(subject).toContain("Réinitialisez votre mot de passe");
    expect(text).toContain("Une réinitialisation de mot de passe");
  });
});
