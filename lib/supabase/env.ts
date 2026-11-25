export class MissingSupabaseEnvError extends Error {
  constructor() {
    super("MISSING_SUPABASE_ENV");
    this.name = "MissingSupabaseEnvError";
  }
}

export function getSupabasePublicEnv(): { url: string; anonKey: string } {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new MissingSupabaseEnvError();
  }

  return { url, anonKey };
}

export function isMissingSupabaseEnv(error: unknown): boolean {
  return error instanceof MissingSupabaseEnvError;
}
