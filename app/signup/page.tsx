import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth-form";
import { getSessionProfile } from "@/server/auth/session";

export const metadata = {
  title: "Create account",
};

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="mx-auto max-w-md px-4 py-12 text-sm text-mist-dim">Loading…</div>
      }
    >
      <SignUpScreen />
    </Suspense>
  );
}

async function SignUpScreen() {
  const session = await getSessionProfile();
  if (session) {
    redirect("/account");
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-white/10 bg-navy-900 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-paper">Create account</h1>
        <p className="mt-2 text-sm leading-6 text-mist">
          New accounts start as buyers. This does not sign you up for prizes,
          payments, or a token.
        </p>
        <div className="mt-6">
          <AuthForm mode="sign-up" />
        </div>
        <p className="mt-6 text-sm text-mist-dim">
          Already have an account?{" "}
          <Link href="/login" className="font-semibold text-electric-300 hover:text-electric-400">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
