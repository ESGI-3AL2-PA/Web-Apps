/**
 * Service d'e-mail de l'auth-service.
 *
 * Sélectionne le transport (SMTP dev → Resend prod → log de repli), expose les gabarits
 * localisés (vérification de compte, réinitialisation de mot de passe) en FR/EN, et les
 * helpers d'envoi `sendVerificationEmail` / `sendPasswordResetEmail`.
 */
import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "../logger.js";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL ?? "no-reply@example.com";
const appName = process.env.APP_NAME ?? "Web-Apps";

// Priorité des transports : SMTP (dev — p. ex. le collecteur mailpit local) → Resend
// (prod) → logger. Définir SMTP_HOST route tout le courrier vers ce serveur, permettant
// au dev local d'inspecter les e-mails de vérification/réinitialisation dans l'UI de
// mailpit plutôt que d'appeler un vrai fournisseur.
const smtpHost = process.env.SMTP_HOST;
const smtpTransport = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      // mailpit accepte le courrier non authentifié ; on ne passe des identifiants que
      // s'ils sont fournis.
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// Repli vers une ligne de log structurée quand ni SMTP ni Resend n'est configuré
// (dev sans fournisseur).
const resend = apiKey ? new Resend(apiKey) : null;

const logFallback = (subject: string, to: string, body: string) => {
  logger.info({ to, subject, body }, "email-fallback (no SMTP/Resend configured)");
};

// Envoi bas niveau : applique la priorité des transports (SMTP → Resend → log de repli).
const send = async (to: string, subject: string, html: string, text: string) => {
  if (smtpTransport) {
    await smtpTransport.sendMail({ from: fromEmail, to, subject, html, text });
    return;
  }
  if (!resend) {
    // Le repli logue le lien complet de vérification/réinitialisation (un secret de type
    // bearer). Acceptable en dev local, mais NE DOIT PAS arriver en production : on
    // échoue donc (fail closed) là-bas plutôt que de fuiter des tokens de prise de
    // contrôle de compte dans les logs.
    if (process.env.NODE_ENV === "production") {
      throw new Error("No email transport configured (set SMTP_HOST or RESEND_API_KEY)");
    }
    logFallback(subject, to, text);
    return;
  }
  const { error } = await resend.emails.send({ from: fromEmail, to, subject, html, text });
  if (error) {
    logger.error({ err: error }, "Resend send failed");
    throw new Error("Email send failed");
  }
};

export type Lang = "fr" | "en";

// Français par défaut — les locales manquantes/inconnues sont traitées comme fr
// (décision produit).
const resolveLang = (lang?: Lang): Lang => (lang === "en" ? "en" : "fr");

type Template = { subject: string; text: string; html: string };

/** Gabarits d'e-mail de vérification de compte, indexés par langue. Le lien expire après 24 h. */
export const verificationTemplates: Record<Lang, (link: string) => Template> = {
  en: (link) => ({
    subject: `Verify your ${appName} account`,
    text: `Welcome to ${appName}!\n\nClick the link below to verify your email:\n${link}\n\nThis link expires in 24 hours.`,
    html: `
    <p>Welcome to ${appName}!</p>
    <p>Click the link below to verify your email:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 24 hours.</p>
  `,
  }),
  fr: (link) => ({
    subject: `Vérifiez votre compte ${appName}`,
    text: `Bienvenue sur ${appName} !\n\nCliquez sur le lien ci-dessous pour vérifier votre adresse e-mail :\n${link}\n\nCe lien expire dans 24 heures.`,
    html: `
    <p>Bienvenue sur ${appName} !</p>
    <p>Cliquez sur le lien ci-dessous pour vérifier votre adresse e-mail :</p>
    <p><a href="${link}">${link}</a></p>
    <p>Ce lien expire dans 24 heures.</p>
  `,
  }),
};

/** Gabarits d'e-mail de réinitialisation de mot de passe, indexés par langue. Le lien expire après 1 h. */
export const passwordResetTemplates: Record<Lang, (link: string) => Template> = {
  en: (link) => ({
    subject: `Reset your ${appName} password`,
    text: `A password reset was requested for your account.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`,
    html: `
    <p>A password reset was requested for your account.</p>
    <p>Click the link below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  `,
  }),
  fr: (link) => ({
    subject: `Réinitialisez votre mot de passe ${appName}`,
    text: `Une réinitialisation de mot de passe a été demandée pour votre compte.\n\nCliquez sur le lien ci-dessous pour définir un nouveau mot de passe :\n${link}\n\nCe lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.`,
    html: `
    <p>Une réinitialisation de mot de passe a été demandée pour votre compte.</p>
    <p>Cliquez sur le lien ci-dessous pour définir un nouveau mot de passe :</p>
    <p><a href="${link}">${link}</a></p>
    <p>Ce lien expire dans 1 heure. Si vous n'êtes pas à l'origine de cette demande, ignorez cet e-mail.</p>
  `,
  }),
};

/** Envoie l'e-mail de vérification de compte dans la langue demandée (fr par défaut). */
export const sendVerificationEmail = async (to: string, link: string, lang?: Lang) => {
  const { subject, text, html } = verificationTemplates[resolveLang(lang)](link);
  await send(to, subject, html, text);
};

/** Envoie l'e-mail de réinitialisation de mot de passe dans la langue demandée (fr par défaut). */
export const sendPasswordResetEmail = async (to: string, link: string, lang?: Lang) => {
  const { subject, text, html } = passwordResetTemplates[resolveLang(lang)](link);
  await send(to, subject, html, text);
};
