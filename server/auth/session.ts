import "server-only";

import { connection } from "next/server";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isMissingSupabaseEnv } from "@/lib/supabase/env";
import { isUserRole, type Profile, type UserRole } from "@/lib/types";

export type SessionProfile = {
  userId: string;
  email: string;
  profile: Profile | null;
};

function asProfile(row: {
  id: string;
  email: string;
  display_name: string;
  role: string;
  created_at: string;
  updated_at: string;
}): Profile | null {
  if (!isUserRole(row.role)) {
    return null;
  }
  return {
    id: row.id,
    email: row.email,
    display_name: row.display_name,
    role: row.role,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export async function getSessionProfile(): Promise<SessionProfile | null> {
  await connection();

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();

    if (error || !data.user) {
      return null;
    }

    const profileResult = await supabase
      .from("profiles")
      .select("id, email, display_name, role, created_at, updated_at")
      .eq("id", data.user.id)
      .maybeSingle();

    const profile = profileResult.data
      ? asProfile(profileResult.data as Profile)
      : null;

    return {
      userId: data.user.id,
      email: data.user.email ?? profile?.email ?? "",
      profile,
    };
  } catch (error) {
    if (isMissingSupabaseEnv(error)) {
      return null;
    }
    throw error;
  }
}

export async function requireSession(): Promise<SessionProfile> {
  const session = await getSessionProfile();
  if (!session) {
    redirect("/login");
  }
  return session;
}

export async function requireRole(role: UserRole): Promise<SessionProfile> {
  const session = await requireSession();
  if (session.profile?.role !== role) {
    redirect("/account");
  }
  return session;
}
