"use client";

import { useActionState } from "react";
import { updateDisplayName } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";

export function DisplayNameForm({ currentName }: { currentName: string }) {
  const [state, formAction] = useActionState<AuthFormState | undefined, FormData>(
    updateDisplayName,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-3">
      <div className="space-y-1.5">
        <label htmlFor="displayName" className="block text-sm font-medium text-mist">
          Name
        </label>
        <input
          id="displayName"
          name="displayName"
          type="text"
          defaultValue={currentName}
          required
          maxLength={80}
          className="h-11 w-full rounded-xl border border-white/15 bg-navy-950 px-3 text-paper"
        />
        {state?.fieldErrors?.displayName ? (
          <p className="text-sm text-orange-300">{state.fieldErrors.displayName}</p>
        ) : null}
      </div>
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
      <SubmitButton pendingLabel="Saving…">Save name</SubmitButton>
    </form>
  );
}
