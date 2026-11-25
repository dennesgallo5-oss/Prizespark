import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/logo";
import { signOut } from "@/server/auth/actions";
import { getSessionProfile } from "@/server/auth/session";

export function SiteHeader() {
  return (
    <header className="border-b border-white/10 bg-navy-950/90 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-4 py-3">
        <Logo priority className="h-14 w-14 sm:h-16 sm:w-16" />
        <Suspense fallback={<SignedOutLinks />}>
          <HeaderLinks />
        </Suspense>
      </div>
    </header>
  );
}

function SignedOutLinks() {
  return (
    <nav className="flex items-center gap-2 text-sm font-semibold" aria-label="Account">
      <Link
        href="/login"
        className="rounded-full px-4 py-2 text-mist hover:text-paper"
      >
        Sign in
      </Link>
      <Link
        href="/signup"
        className="rounded-full bg-electric-500 px-4 py-2 text-navy-950 hover:bg-electric-400"
      >
        Create account
      </Link>
    </nav>
  );
}

async function HeaderLinks() {
  const session = await getSessionProfile();

  if (!session) {
    return <SignedOutLinks />;
  }

  const isAdmin = session.profile?.role === "admin";

  return (
    <nav className="flex flex-wrap items-center gap-2 text-sm font-semibold" aria-label="Account">
      <Link href="/account" className="rounded-full px-4 py-2 text-mist hover:text-paper">
        Your account
      </Link>
      {isAdmin ? (
        <Link href="/admin" className="rounded-full px-4 py-2 text-mist hover:text-paper">
          Admin
        </Link>
      ) : null}
      <form action={signOut}>
        <button
          type="submit"
          className="rounded-full border border-white/15 px-4 py-2 text-paper hover:border-electric-400"
        >
          Sign out
        </button>
      </form>
    </nav>
  );
}
