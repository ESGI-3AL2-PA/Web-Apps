import { Resend } from "resend";

const apiKey = process.env.RESEND_API_KEY;
const fromEmail = process.env.FROM_EMAIL ?? "no-reply@example.com";
const appName = process.env.APP_NAME ?? "Web-Apps";

// Falls back to console.log when RESEND_API_KEY is missing (dev mode without a real provider).
const resend = apiKey ? new Resend(apiKey) : null;

const logFallback = (subject: string, to: string, body: string) => {
  console.log(`\n📧  [email-fallback] To: ${to}\n    Subject: ${subject}\n    ${body.replace(/\n/g, "\n    ")}\n`);
};

const send = async (to: string, subject: string, html: string, text: string) => {
  if (!resend) {
    logFallback(subject, to, text);
    return;
  }
  const { error } = await resend.emails.send({ from: fromEmail, to, subject, html, text });
  if (error) {
    console.error("Resend send failed:", error);
    throw new Error("Email send failed");
  }
};

export const sendVerificationEmail = async (to: string, link: string) => {
  const subject = `Verify your ${appName} account`;
  const text = `Welcome to ${appName}!\n\nClick the link below to verify your email:\n${link}\n\nThis link expires in 24 hours.`;
  const html = `
    <p>Welcome to ${appName}!</p>
    <p>Click the link below to verify your email:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 24 hours.</p>
  `;
  await send(to, subject, html, text);
};

export const sendPasswordResetEmail = async (to: string, link: string) => {
  const subject = `Reset your ${appName} password`;
  const text = `A password reset was requested for your account.\n\nClick the link below to set a new password:\n${link}\n\nThis link expires in 1 hour. If you didn't request this, ignore this email.`;
  const html = `
    <p>A password reset was requested for your account.</p>
    <p>Click the link below to set a new password:</p>
    <p><a href="${link}">${link}</a></p>
    <p>This link expires in 1 hour. If you didn't request this, ignore this email.</p>
  `;
  await send(to, subject, html, text);
};
