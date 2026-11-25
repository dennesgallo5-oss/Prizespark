import { readFileSync, existsSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

loadEnvFile(new URL("../.env.local", import.meta.url));

const url = required("NEXT_PUBLIC_SUPABASE_URL");
const serviceKey = required("SUPABASE_SERVICE_ROLE_KEY");
const databaseUrl = required("DATABASE_URL");

assertLoopback(url, "NEXT_PUBLIC_SUPABASE_URL");
assertLoopback(databaseUrl, "DATABASE_URL");

const FAKE_PASSWORD = "LocalPreview-Only-1";

const people = [
  {
    email: "ada.buyer@example.test",
    displayName: "Ada Buyer (fake)",
    role: "buyer",
  },
  {
    email: "ben.seller@example.test",
    displayName: "Ben Seller (fake)",
    role: "seller",
  },
  {
    email: "casey.admin@example.test",
    displayName: "Casey Admin (fake)",
    role: "admin",
  },
];

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const db = new pg.Client({ connectionString: databaseUrl });
await db.connect();

try {
  for (const person of people) {
    const userId = await ensureUser(person);
    if (person.role === "buyer") {
      continue;
    }
    await assignRole(userId, person);
  }
} finally {
  await db.end();
}

console.log("Fake local accounts are ready. They only work on this computer.");
console.log("Password for every fake account: LocalPreview-Only-1");
for (const person of people) {
  console.log(`- ${person.email} (${person.role})`);
}

async function ensureUser(person) {
  const existing = await db.query("select id from auth.users where email = $1", [person.email]);
  if (existing.rows[0]) {
    return existing.rows[0].id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    password: FAKE_PASSWORD,
    email_confirm: true,
    user_metadata: { display_name: person.displayName },
  });

  if (error || !data.user) {
    throw new Error(`Could not create ${person.email}: ${error?.message ?? "no user returned"}`);
  }

  return data.user.id;
}

async function assignRole(userId, person) {
  const current = await db.query("select role from public.profiles where id = $1", [userId]);
  if (!current.rows[0]) {
    throw new Error(`Profile missing for ${person.email}. The sign-up trigger may have failed.`);
  }
  if (current.rows[0].role === person.role) {
    return;
  }

  await db.query("begin");
  try {
    const before = current.rows[0].role;
    await db.query("select set_config('prizespark.allow_role_change', '1', true)");
    await db.query("update public.profiles set role = $1 where id = $2", [person.role, userId]);
    await db.query("select set_config('prizespark.allow_role_change', '0', true)");
    await db.query(
      "select public.write_audit_event($1, 'role.change', 'profile', $2, $3::jsonb, $4::jsonb)",
      [
        null,
        userId,
        JSON.stringify({ role: before, email: person.email }),
        JSON.stringify({ role: person.role, email: person.email, via: "local-seed" }),
      ],
    );
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Run npm run env:local first.`);
  }
  return value;
}

function assertLoopback(value, name) {
  const host = hostnameOf(value);
  if (!["localhost", "127.0.0.1", "::1"].includes(host)) {
    throw new Error(`Refusing to seed ${name} because ${host} is not this computer.`);
  }
}

function hostnameOf(value) {
  if (value.includes("://")) {
    return new URL(value).hostname;
  }
  const withoutAuth = value.replace(/^postgres(?:ql)?:\/\/(?:[^@]+@)?/, "");
  return withoutAuth.split(":")[0].split("/")[0];
}

function loadEnvFile(fileUrl) {
  const path = fileUrl.pathname;
  if (!existsSync(path)) {
    return;
  }
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const separator = trimmed.indexOf("=");
    if (separator === -1) {
      continue;
    }
    const key = trimmed.slice(0, separator);
    if (!process.env[key]) {
      process.env[key] = trimmed.slice(separator + 1);
    }
  }
}
