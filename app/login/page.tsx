import Link from "next/link";
import { Suspense } from "react";
import { AuthForm } from "@/components/auth-form";
import { redirect } from "next/navigation";
import { getSessionProfile } from "@/server/auth/session";

export const metadata = {
  title: "Sign in",
};

export default function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  return (
    <Suspense fallback={<AuthCardFallback title="Sign in" />}>
      <LoginScreen searchParams={searchParams} />
    </Suspense>
  );
}

async function LoginScreen({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const session = await getSessionProfile();
  if (session) {
    redirect("/account");
  }

  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const nextPath = nextValue?.startsWith("/") && !nextValue.startsWith("//") ? nextValue : undefined;

  return (
    <AuthCard
      title="Sign in"
      lede="Use the email and password for this development preview."
      footer={
        <>
          No account yet?{" "}
          <Link href="/signup" className="font-semibold text-electric-300 hover:text-electric-400">
            Create one
          </Link>
        </>
      }
    >
      <AuthForm mode="sign-in" nextPath={nextPath} />
    </AuthCard>
  );
}

function AuthCard({
  title,
  lede,
  children,
  footer,
}: {
  title: string;
  lede: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-white/10 bg-navy-900 p-6 sm:p-8">
        <h1 className="text-2xl font-semibold text-paper">{title}</h1>
        <p className="mt-2 text-sm leading-6 text-mist">{lede}</p>
        <div className="mt-6">{children}</div>
        <p className="mt-6 text-sm text-mist-dim">{footer}</p>
      </div>
    </div>
  );
}

function AuthCardFallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <div className="rounded-3xl border border-white/10 bg-navy-900 p-8">
        <h1 className="text-2xl font-semibold text-paper">{title}</h1>
        <p className="mt-4 text-sm text-mist-dim">Loading…</p>
      </div>
    </div>
  );
}
