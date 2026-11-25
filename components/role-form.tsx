"use client";

import { useActionState } from "react";
import { changeUserRole } from "@/server/auth/actions";
import { ROLES, type AuthFormState, type UserRole } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";

const labels: Record<UserRole, string> = {
  buyer: "Buyer",
  seller: "Seller",
  admin: "Administrator",
};

export function RoleForm({
  userId,
  role,
}: {
  userId: string;
  role: UserRole;
}) {
  const [state, formAction] = useActionState<AuthFormState | undefined, FormData>(
    changeUserRole,
    undefined,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input type="hidden" name="userId" value={userId} />
      <label className="sr-only" htmlFor={`role-${userId}`}>
        Role
      </label>
      <select
        id={`role-${userId}`}
        name="role"
        defaultValue={role}
        className="h-10 rounded-lg border border-white/15 bg-navy-950 px-2 text-sm text-paper"
      >
        {ROLES.map((option) => (
          <option key={option} value={option}>
            {labels[option]}
          </option>
        ))}
      </select>
      <SubmitButton pendingLabel="Saving…">Save role</SubmitButton>
      {state?.error ? (
        <p className="text-sm text-orange-300" role="alert">
          {state.error}
        </p>
      ) : null}
      {state?.message ? (
        <p className="text-sm text-electric-300" role="status">
          {state.message}
        </p>
      ) : null}
    </form>
  );
}
