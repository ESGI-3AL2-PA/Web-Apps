/**
 * Suite de tests des gabarits d'e-mail (i18n).
 *
 * Vérifie que chaque gabarit (vérification de compte, réinitialisation de mot de passe)
 * existe en anglais et en français, produit le bon sujet localisé et incorpore bien le
 * lien fourni dans le corps HTML/texte.
 */
import { describe, expect, it } from "vitest";
import { passwordResetTemplates, verificationTemplates } from "./email.service.js";

const LINK = "https://example.test/link?token=abc";

describe("email templates i18n", () => {
  // Gabarit de vérification EN : sujet + corps anglais, lien présent.
  it("selects the English verification template", () => {
    const { subject, text, html } = verificationTemplates.en(LINK);
    expect(subject).toContain("Verify your");
    expect(text).toContain("Welcome to");
    expect(html).toContain(LINK);
  });

  // Gabarit de vérification FR : sujet + corps français, lien présent.
  it("selects the French verification template", () => {
    const { subject, text, html } = verificationTemplates.fr(LINK);
    expect(subject).toContain("Vérifiez votre compte");
    expect(text).toContain("Bienvenue sur");
    expect(html).toContain(LINK);
  });

  // Gabarit de réinitialisation EN : sujet + corps anglais.
  it("selects the English password-reset template", () => {
    const { subject, text } = passwordResetTemplates.en(LINK);
    expect(subject).toContain("Reset your");
    expect(text).toContain("A password reset was requested");
  });

  // Gabarit de réinitialisation FR : sujet + corps français.
  it("selects the French password-reset template", () => {
    const { subject, text } = passwordResetTemplates.fr(LINK);
    expect(subject).toContain("Réinitialisez votre mot de passe");
    expect(text).toContain("Une réinitialisation de mot de passe");
  });
});
