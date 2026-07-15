import { Resend } from "resend";
import nodemailer from "nodemailer";
import { logger } from "../logger.js";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL ?? "no-reply@example.com";
const appName = process.env.APP_NAME ?? "Web-Apps";

// Transport priority: SMTP (dev — e.g. the local mailpit sink) → Resend (prod) → logger.
// Setting SMTP_HOST routes all mail to that server, letting local dev inspect
// verification/reset emails in mailpit's UI instead of hitting a real provider.
const smtpHost = process.env.SMTP_HOST;
const smtpTransport = smtpHost
  ? nodemailer.createTransport({
      host: smtpHost,
      port: Number(process.env.SMTP_PORT ?? 1025),
      secure: process.env.SMTP_SECURE === "true",
      // mailpit accepts unauthenticated mail; only pass credentials when provided.
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  : null;

// Falls back to a structured log line when neither SMTP nor Resend is configured (dev without a provider).
const resend = apiKey ? new Resend(apiKey) : null;

const logFallback = (subject: string, to: string, body: string) => {
  logger.info({ to, subject, body }, "email-fallback (no SMTP/Resend configured)");
};

const send = async (to: string, subject: string, html: string, text: string) => {
  if (smtpTransport) {
    await smtpTransport.sendMail({ from: fromEmail, to, subject, html, text });
    return;
  }
  if (!resend) {
    // The fallback logs the full verification/reset link (a bearer secret). That is
    // acceptable for local dev but MUST NOT happen in production, so fail closed there
    // rather than leaking account-takeover tokens into the logs.
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

// Default to French — missing/unknown locales are treated as fr per product decision.
const resolveLang = (lang?: Lang): Lang => (lang === "en" ? "en" : "fr");

type Template = { subject: string; text: string; html: string };

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

export const sendVerificationEmail = async (to: string, link: string, lang?: Lang) => {
  const { subject, text, html } = verificationTemplates[resolveLang(lang)](link);
  await send(to, subject, html, text);
};

export const sendPasswordResetEmail = async (to: string, link: string, lang?: Lang) => {
  const { subject, text, html } = passwordResetTemplates[resolveLang(lang)](link);
  await send(to, subject, html, text);
};
