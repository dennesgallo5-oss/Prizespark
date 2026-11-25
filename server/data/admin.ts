import "server-only";

import { createClient } from "@/lib/supabase/server";
import {
  isUserRole,
  type AuditChainStatus,
  type AuditEvent,
  type Profile,
} from "@/lib/types";

const PROFILE_COLUMNS = "id, email, display_name, role, created_at, updated_at";
const AUDIT_COLUMNS =
  "id, chain_position, actor_id, action, entity_type, entity_id, before_state, after_state, created_at, prev_hash, row_hash";

function asProfile(row: Profile): Profile | null {
  if (!isUserRole(row.role)) {
    return null;
  }
  return row;
}

export async function listProfiles(): Promise<Profile[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .order("created_at", { ascending: true })
    .limit(200);

  if (error) {
    throw new Error("Could not load accounts.");
  }

  return (data as Profile[]).flatMap((row) => {
    const profile = asProfile(row);
    return profile ? [profile] : [];
  });
}

export async function listAuditEvents(): Promise<AuditEvent[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("audit_events")
    .select(AUDIT_COLUMNS)
    .order("chain_position", { ascending: false })
    .limit(200);

  if (error) {
    throw new Error("Could not load the activity log.");
  }

  return (data ?? []) as AuditEvent[];
}

export async function readAuditChain(): Promise<AuditChainStatus> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("verify_audit_chain");

  if (error || !Array.isArray(data) || data.length === 0) {
    throw new Error("Could not check the activity log.");
  }

  const row = data[0] as AuditChainStatus;
  return {
    is_valid: Boolean(row.is_valid),
    checked_count: Number(row.checked_count ?? 0),
    first_broken_id: row.first_broken_id ?? null,
  };
}
