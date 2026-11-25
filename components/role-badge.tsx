import type { UserRole } from "@/lib/types";

const labels: Record<UserRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  admin: "Administrator",
};

const styles: Record<UserRole, string> = {
  buyer: "border-mist-dim/40 text-mist",
  seller: "border-electric-400/50 text-electric-300",
  admin: "border-orange-400/60 text-orange-300",
};

export function RoleBadge({ role }: { role: UserRole }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-wide ${styles[role]}`}
    >
      {labels[role]}
    </span>
  );
}

export function roleLabel(role: UserRole): string {
  return labels[role];
}
