// Script de seed (exécuté hors du serveur HTTP) : crée ou promeut le compte
// superAdmin, le seul rôle que le flux d'inscription ne peut pas produire.
import { randomUUID } from "crypto";
import argon2 from "argon2";
import { connectDB } from "./repositories/mongodb.connector.js";

// Crée (ou promeut) un superAdmin — le seul rôle que le flux d'inscription ne
// peut pas créer. Idempotent : indexé sur l'email. Une réexécution n'écrase
// jamais le mot de passe d'un utilisateur existant ; elle garantit seulement que
// le compte est un superAdmin vérifié. Configuration via variables d'environnement.
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
      // Appliqué uniquement à la création — promouvoir un utilisateur existant
      // laisse ces champs intacts.
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
      // Toujours imposé, à la création comme à la promotion.
      $set: { role: "superAdmin", emailVerified: true, updatedAt: now },
    },
    { upsert: true },
  );

  // upsertedCount > 0 => insertion (création). Sinon, le compte existait déjà.
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
