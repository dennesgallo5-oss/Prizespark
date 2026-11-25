import { Suspense } from "react";
import Link from "next/link";
import { DisplayNameForm } from "@/components/display-name-form";
import { RoleBadge, roleLabel } from "@/components/role-badge";
import { requireSession } from "@/server/auth/session";

export const metadata = {
  title: "Your account",
};

export default function AccountPage() {
  return (
    <Suspense fallback={<PageFallback title="Your account" />}>
      <AccountScreen />
    </Suspense>
  );
}

async function AccountScreen() {
  const session = await requireSession();
  const profile = session.profile;

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-paper">Your account</h1>
      <p className="mt-2 text-mist">
        This page shows the access level stored for your account. It does not
        unlock selling, auctions, or prizes.
      </p>

      <section className="mt-8 rounded-3xl border border-white/10 bg-navy-900 p-6">
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-mist-dim">Email</dt>
            <dd className="mt-1 text-paper">{profile?.email || session.email}</dd>
          </div>
          <div>
            <dt className="text-xs font-semibold uppercase tracking-wide text-mist-dim">Role</dt>
            <dd className="mt-1">
              {profile ? <RoleBadge role={profile.role} /> : "Not available"}
            </dd>
          </div>
        </dl>
        <p className="mt-4 text-sm leading-6 text-mist">{roleExplanation(profile?.role)}</p>
        {profile?.role === "admin" ? (
          <Link
            href="/admin"
            className="mt-4 inline-flex text-sm font-semibold text-electric-300 hover:text-electric-400"
          >
            Open the admin page
          </Link>
        ) : null}
      </section>

      {profile ? (
        <section className="mt-6 rounded-3xl border border-white/10 bg-navy-900 p-6">
          <h2 className="text-lg font-semibold text-paper">Display name</h2>
          <p className="mt-1 text-sm text-mist">
            You can change your name. You cannot change your role.
          </p>
          <div className="mt-4">
            <DisplayNameForm currentName={profile.display_name} />
          </div>
        </section>
      ) : (
        <p className="mt-6 text-sm text-orange-300">
          Your sign-in worked, but the profile row is missing. Ask an administrator to check the database.
        </p>
      )}
    </div>
  );
}

function roleExplanation(role: string | undefined): string {
  if (role === "admin") {
    return "You are an administrator. You can review accounts and change roles. Those changes are written to the activity log.";
  }
  if (role === "seller") {
    return "Your role is seller. This preview does not include seller tools.";
  }
  if (role === "buyer") {
    return `${roleLabel("buyer")} is the starting role. An administrator would have to change it. This preview does not include a shop.`;
  }
  return "Your role could not be read.";
}

function PageFallback({ title }: { title: string }) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-paper">{title}</h1>
      <p className="mt-3 text-sm text-mist-dim">Loading…</p>
    </div>
  );
}
