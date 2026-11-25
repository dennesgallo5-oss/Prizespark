"use client";

import { useActionState } from "react";
import { signIn, signUp } from "@/server/auth/actions";
import type { AuthFormState } from "@/lib/types";
import { SubmitButton } from "@/components/submit-button";

const fieldClass =
  "h-11 w-full rounded-xl border border-white/15 bg-navy-950 px-3 text-paper placeholder:text-mist-dim";

export function AuthForm({
  mode,
  nextPath,
}: {
  mode: "sign-in" | "sign-up";
  nextPath?: string;
}) {
  const action = mode === "sign-in" ? signIn : signUp;
  const [state, formAction] = useActionState<AuthFormState | undefined, FormData>(
    action,
    undefined,
  );

  return (
    <form action={formAction} className="space-y-4" noValidate>
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

      {mode === "sign-up" ? (
        <Field
          id="displayName"
          label="Name"
          name="displayName"
          type="text"
          autoComplete="name"
          error={state?.fieldErrors?.displayName}
        />
      ) : null}

      <Field
        id="email"
        label="Email"
        name="email"
        type="email"
        autoComplete="email"
        error={state?.fieldErrors?.email}
      />

      <Field
        id="password"
        label="Password"
        name="password"
        type="password"
        autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
        error={state?.fieldErrors?.password}
        hint={mode === "sign-up" ? "At least 8 characters." : undefined}
      />

      {state?.error ? (
        <p className="rounded-xl bg-orange-500/15 px-3 py-2 text-sm text-orange-300" role="alert">
          {state.error}
        </p>
      ) : null}

      {state?.message ? (
        <p className="rounded-xl bg-electric-500/15 px-3 py-2 text-sm text-electric-300" role="status">
          {state.message}
        </p>
      ) : null}

      <SubmitButton
        pendingLabel={mode === "sign-in" ? "Signing in…" : "Creating account…"}
      >
        {mode === "sign-in" ? "Sign in" : "Create account"}
      </SubmitButton>
    </form>
  );
}

function Field({
  id,
  label,
  name,
  type,
  autoComplete,
  error,
  hint,
}: {
  id: string;
  label: string;
  name: string;
  type: string;
  autoComplete: string;
  error?: string;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-mist">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        autoComplete={autoComplete}
        required
        className={fieldClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
      />
      {hint ? (
        <p id={`${id}-hint`} className="text-xs text-mist-dim">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-orange-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
