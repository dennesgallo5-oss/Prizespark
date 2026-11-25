import { existsSync, readFileSync } from "node:fs";
import pg from "pg";
import { createClient } from "@supabase/supabase-js";

export function loadEnv() {
  for (const name of [".env.local", ".env"]) {
    if (!existsSync(name)) {
      continue;
    }
    for (const line of readFileSync(name, "utf8").split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
        continue;
      }
      const separator = trimmed.indexOf("=");
      const key = trimmed.slice(0, separator);
      if (!process.env[key]) {
        process.env[key] = trimmed.slice(separator + 1);
      }
    }
  }
}

export function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing ${name}. Start Supabase and run npm run env:local.`);
  }
  return value;
}

export function publicClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export function serviceClient() {
  return createClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function connectDatabase() {
  const client = new pg.Client({ connectionString: requireEnv("DATABASE_URL") });
  await client.connect();
  return client;
}

export async function createConfirmedUser(admin, { email, password, displayName }) {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { display_name: displayName },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? "createUser failed");
  }
  return data.user;
}

export async function signIn(email, password) {
  const client = publicClient();
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.user) {
    throw new Error(error?.message ?? "sign in failed");
  }
  return client;
}

export async function bootstrapRole(db, userId, role) {
  await db.query("begin");
  try {
    const current = await db.query("select role, email from public.profiles where id = $1", [userId]);
    const before = current.rows[0];
    await db.query("select set_config('prizespark.allow_role_change', '1', true)");
    await db.query("update public.profiles set role = $1 where id = $2", [role, userId]);
    await db.query("select set_config('prizespark.allow_role_change', '0', true)");
    await db.query(
      "select public.write_audit_event($1, 'role.change', 'profile', $2, $3::jsonb, $4::jsonb)",
      [
        null,
        userId,
        JSON.stringify({ role: before.role, email: before.email }),
        JSON.stringify({ role, email: before.email, via: "test-bootstrap" }),
      ],
    );
    await db.query("commit");
  } catch (error) {
    await db.query("rollback");
    throw error;
  }
}
