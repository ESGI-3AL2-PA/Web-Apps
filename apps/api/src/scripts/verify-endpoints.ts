/**
 * End-to-end endpoint verification for the SATAN-backed repositories.
 *
 * Logs in against the auth-service, then walks the api's routes — the SATAN-QL
 * paths (getById across entities, the paginated COUNT+FIND lists incl. CONTAINS
 * search, balance projection, setBanned update, id deletes) strictly, and the
 * remaining Mongo-fallback aggregations as smoke. Prints a PASS/FAIL/SKIP table
 * and, when OUT is set, writes a JSON summary (getById + full list bodies) so the
 * same run can be compared with SATAN_REPOS=true vs false (parity).
 *
 * Usage:
 *   API_URL=http://localhost:3100 AUTH_URL=http://localhost:3001 \
 *     OUT=/tmp/satan-on.json npx tsx apps/api/src/scripts/verify-endpoints.ts
 */
import { writeFileSync } from "node:fs";

const API = process.env.API_URL ?? "http://localhost:3100";
const AUTH = process.env.AUTH_URL ?? "http://localhost:3001";

type Res = { status: number; json: unknown };
const results: { name: string; state: "PASS" | "FAIL" | "SKIP"; detail: string }[] = [];
const record = (name: string, state: "PASS" | "FAIL" | "SKIP", detail = "") => results.push({ name, state, detail });

async function login(email: string, password: string): Promise<string> {
  const r = await fetch(`${AUTH}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const body = (await r.json()) as { access_token?: string };
  if (!body.access_token) throw new Error(`login ${email} failed: HTTP ${r.status}`);
  return body.access_token;
}

async function req(method: string, path: string, token: string, body?: unknown): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body ? { "Content-Type": "application/json" } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await r.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  return { status: r.status, json };
}

const idOf = (v: unknown): string | undefined =>
  v && typeof v === "object" && "id" in v ? String((v as { id: unknown }).id) : undefined;
const firstId = (listBody: unknown): string | undefined => {
  const data = (listBody as { data?: unknown[] })?.data;
  return Array.isArray(data) && data[0] ? idOf(data[0]) : undefined;
};

async function main() {
  const su = await login("superadmin@local.dev", "ChangeMe!2345");

  // --- getById via SATAN find (discover an id from the list, then read it) ---
  const entities: { name: string; list: string; byId: (id: string) => string; path: string; note?: string }[] = [
    { name: "users", list: "/users", byId: (id) => `/users/${id}`, path: "users" },
    { name: "districts", list: "/districts", byId: (id) => `/districts/${id}`, path: "districts" },
    { name: "listings", list: "/listings", byId: (id) => `/listings/${id}`, path: "listings" },
    { name: "events", list: "/events", byId: (id) => `/events/${id}`, path: "events" },
    { name: "incidents", list: "/incidents", byId: (id) => `/incidents/${id}`, path: "incidents" },
    { name: "tags", list: "/tags", byId: (id) => `/tags/${id}`, path: "tags" },
    { name: "contracts", list: "/contracts", byId: (id) => `/contracts/${id}`, path: "contracts" },
    {
      name: "district-admins",
      list: "/district-admins",
      byId: (id) => `/district-admins/${id}`,
      path: "district-admins",
    },
    { name: "notifications", list: "/notifications", byId: (id) => `/notifications/${id}`, path: "notifications" },
    {
      name: "votes",
      list: "/votes",
      byId: (id) => `/votes/${id}`,
      path: "votes",
      note: "getVoteById is Mongo fallback (enrichment)",
    },
  ];

  const byIdBodies: Record<string, unknown> = {};
  for (const e of entities) {
    const list = await req("GET", `${e.list}?limit=1`, su);
    if (list.status !== 200) {
      record(`GET ${e.list}`, "FAIL", `list HTTP ${list.status}`);
      continue;
    }
    record(`GET ${e.list} (list smoke)`, "PASS", "");
    const id = firstId(list.json);
    if (!id) {
      record(`GET ${e.byId(":id")} (SATAN getById)`, "SKIP", "no seeded row");
      continue;
    }
    const one = await req("GET", e.byId(id), su);
    const ok = one.status === 200 && idOf(one.json) === id;
    byIdBodies[e.name] = one.json;
    record(
      `GET ${e.byId(":id")} (SATAN getById)`,
      ok ? "PASS" : "FAIL",
      `HTTP ${one.status}, id match ${idOf(one.json) === id}${e.note ? ` [${e.note}]` : ""}`,
    );
  }

  // --- SATAN paginated lists (COUNT + FIND, incl. CONTAINS search) ---
  // Captured in full so the SATAN-on vs -off runs can be diffed for parity.
  const listBodies: Record<string, unknown> = {};
  const listProbes: [string, string][] = [
    ["/users?page=1&limit=5", "users:page"],
    ["/users?search=a&limit=5", "users:search"],
    ["/listings?page=1&limit=5", "listings:page"],
    ["/listings?search=e&limit=5", "listings:search"],
    ["/events?page=1&limit=5", "events:page"],
    ["/events?status=upcoming&limit=5", "events:upcoming"],
    ["/incidents?page=1&limit=5", "incidents:page"],
    ["/incidents?search=a&limit=5", "incidents:search"],
    ["/tags?page=1&limit=5", "tags:page"],
    ["/tags?search=a&limit=5", "tags:search"],
    ["/districts?page=1&limit=5", "districts:page"],
    ["/districts?search=a&limit=5", "districts:search"],
    ["/contracts?page=1&limit=5", "contracts:page"],
    ["/district-admins?page=1&limit=5", "district-admins:page"],
    ["/notifications?page=1&limit=5", "notifications:page"],
  ];
  for (const [path, label] of listProbes) {
    const r = await req("GET", path, su);
    listBodies[label] = r.json;
    const body = r.json as { data?: unknown; total?: unknown };
    const ok = r.status === 200 && Array.isArray(body?.data) && typeof body?.total === "number";
    record(`GET ${path} (SATAN list)`, ok ? "PASS" : "FAIL", `HTTP ${r.status}`);
  }

  // --- SATAN getBalance (projection) ---
  const bal = await req("GET", "/users/seed-user-alice/balance", su);
  record(
    "GET /users/:id/balance (SATAN getBalance)",
    bal.status === 200 && typeof (bal.json as { balance?: unknown })?.balance === "number" ? "PASS" : "FAIL",
    `HTTP ${bal.status} ${JSON.stringify(bal.json)}`,
  );

  // --- Mongo-fallback aggregations (smoke) ---
  const stats = await req("GET", "/incidents/stats", su);
  record("GET /incidents/stats (fallback smoke)", stats.status === 200 ? "PASS" : "FAIL", `HTTP ${stats.status}`);

  // --- SATAN setBanned round-trip (updateReturning) ---
  const ban = await req("PATCH", "/users/seed-user-bob/ban", su, { banned: true });
  const bannedOk = ban.status === 200 && (ban.json as { banned?: boolean })?.banned === true;
  const unban = await req("PATCH", "/users/seed-user-bob/ban", su, { banned: false });
  const unbannedOk = unban.status === 200 && (unban.json as { banned?: boolean })?.banned === false;
  record(
    "PATCH /users/:id/ban (SATAN setBanned)",
    bannedOk && unbannedOk ? "PASS" : "FAIL",
    `ban HTTP ${ban.status}=${(ban.json as { banned?: boolean })?.banned}, unban HTTP ${unban.status}=${(unban.json as { banned?: boolean })?.banned}`,
  );

  // --- SATAN delete round-trip (create → SATAN getById → SATAN delete → 404) ---
  // Mirror an existing tag's shape so the create body satisfies the contract.
  const tagsList = await req("GET", "/tags?limit=1", su);
  const sampleTag = (tagsList.json as { data?: Record<string, unknown>[] })?.data?.[0];
  if (sampleTag) {
    const { id: _id, createdAt: _c, updatedAt: _u, name: _n, ...rest } = sampleTag;
    const create = await req("POST", "/tags", su, {
      ...rest,
      name: `satan-verify-${Date.now()}`,
      districtId: rest.districtId ?? "seed-district-montmartre",
    });
    const newId = idOf(create.json);
    if (create.status < 300 && newId) {
      const got = await req("GET", `/tags/${newId}`, su); // SATAN getTagById
      const del = await req("DELETE", `/tags/${newId}`, su); // SATAN deleteTag
      const gone = await req("GET", `/tags/${newId}`, su);
      const ok = got.status === 200 && del.status >= 200 && del.status < 300 && gone.status === 404;
      record(
        "tag create→SATAN getById→SATAN delete→404",
        ok ? "PASS" : "FAIL",
        `get ${got.status}, del ${del.status}, gone ${gone.status}`,
      );
    } else {
      record(
        "tag delete round-trip",
        "SKIP",
        `create HTTP ${create.status} ${JSON.stringify(create.json).slice(0, 120)}`,
      );
    }
  } else {
    record("tag delete round-trip", "SKIP", "no sample tag to mirror");
  }

  // --- report ---
  const pass = results.filter((r) => r.state === "PASS").length;
  const fail = results.filter((r) => r.state === "FAIL").length;
  const skip = results.filter((r) => r.state === "SKIP").length;
  for (const r of results) console.warn(`${r.state.padEnd(4)} ${r.name}${r.detail ? `  — ${r.detail}` : ""}`);
  console.warn(
    `\n${pass} passed, ${fail} failed, ${skip} skipped  (SATAN_REPOS=${process.env.SATAN_REPOS ?? "unset"})`,
  );

  if (process.env.OUT) {
    writeFileSync(process.env.OUT, JSON.stringify({ results, byIdBodies, listBodies }, null, 2));
    console.warn(`summary → ${process.env.OUT}`);
  }
  process.exit(fail > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
