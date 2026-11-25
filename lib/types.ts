export const ROLES = ["buyer", "seller", "admin"] as const;

export type UserRole = (typeof ROLES)[number];

export type Profile = {
  id: string;
  email: string;
  display_name: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
};

export type AuditEvent = {
  id: string;
  chain_position: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  before_state: Record<string, unknown> | null;
  after_state: Record<string, unknown> | null;
  created_at: string;
  prev_hash: string;
  row_hash: string;
};

export type AuditChainStatus = {
  is_valid: boolean;
  checked_count: number;
  first_broken_id: string | null;
};

export type AuthFormState = {
  error?: string;
  message?: string;
  fieldErrors?: {
    email?: string;
    password?: string;
    displayName?: string;
  };
};

export function isUserRole(value: unknown): value is UserRole {
  return value === "buyer" || value === "seller" || value === "admin";
}
