import { randomUUID } from "crypto";
import argon2 from "argon2";
import { connectDB } from "./repositories/mongodb.connector.js";

// Seeds (or promotes) a superAdmin — the only role the register flow can't create.
// Idempotent: keyed on email. Re-running never clobbers an existing user's password;
// it just ensures the account is a verified superAdmin. Configure via env.
const email = process.env.SEED_SUPERADMIN_EMAIL ?? "superadmin@local.dev";
const password = process.env.SEED_SUPERADMIN_PASSWORD ?? "ChangeMe!2345";
const firstName = process.env.SEED_SUPERADMIN_FIRSTNAME ?? "Super";
const lastName = process.env.SEED_SUPERADMIN_LASTNAME ?? "Admin";

const seed = async () => {
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
        balance: 0,
        totpSecret: null,
        totpEnabled: false,
        createdAt: now,
      },
      // Always enforced, whether creating or promoting. superAdmin belongs to no district, so
      // clear districtId even when promoting an existing (district-scoped) user.
      $set: { role: "superAdmin", districtId: null, emailVerified: true, updatedAt: now },
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
