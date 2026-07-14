import { randomUUID } from "crypto";
import argon2 from "argon2";
import { connectDB } from "./repositories/mongodb.connector.js";

// Seeds (or promotes) a superAdmin — the only role the register flow can't create.
// Idempotent: keyed on email. Re-running never clobbers an existing user's password;
// it just ensures the account is a verified superAdmin. Configure via env.
const DEFAULT_SUPERADMIN_PASSWORD = "ChangeMe!2345";
// Passwords that must never seed a production superAdmin: the code fallback below and
// the .env.dist placeholder. Fail-closed so a copy-pasted template can't create a
// superAdmin with a publicly-known password.
const UNSAFE_SUPERADMIN_PASSWORDS = new Set([DEFAULT_SUPERADMIN_PASSWORD, "__CHANGE_ME__"]);

const email = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@local.dev";
const password = process.env.SEED_SUPERADMIN_PASSWORD ?? DEFAULT_SUPERADMIN_PASSWORD;
const firstName = process.env.SEED_SUPERADMIN_FIRSTNAME ?? "Super";
const lastName = process.env.SEED_SUPERADMIN_LASTNAME ?? "Admin";

const seed = async () => {
  // Mirror keys.ts: refuse in production rather than seed a known/default password.
  if (process.env.NODE_ENV === "production" && UNSAFE_SUPERADMIN_PASSWORDS.has(password)) {
    console.error(
      "❌  Refusing to seed a superAdmin with the default/placeholder password when NODE_ENV=production " +
        "(set SEED_SUPERADMIN_PASSWORD to a strong secret).",
    );
    process.exit(1);
  }

  const db = await connectDB();
  const now = new Date().toISOString();

  const result = await db.collection("users").updateOne(
    { email },
    {
      // Set only when creating — promoting an existing user leaves these untouched.
      $setOnInsert: {
        _id: randomUUID(),
        email,
        passwordHash: await argon2.hash(password),
        firstName,
        lastName,
        address: "",
        districtId: "",
        balance: 0,
        totpSecret: null,
        totpEnabled: false,
        createdAt: now,
      },
      // Always enforced, whether creating or promoting.
      $set: { role: "superAdmin", emailVerified: true, updatedAt: now },
    },
    { upsert: true },
  );

  if (result.upsertedCount > 0) {
    console.warn(`Seeded superAdmin ${email} with password "${password}" — change it after first login.`);
  } else {
    console.warn(`User ${email} already existed; ensured role superAdmin (password unchanged).`);
  }

  process.exit(0);
};

seed().catch((err) => {
  console.error("Superadmin seed failed:", err);
  process.exit(1);
});
