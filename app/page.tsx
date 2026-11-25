import Link from "next/link";
import { Logo } from "@/components/logo";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
      <section className="grid items-center gap-10 lg:grid-cols-[auto,1fr]">
        <Logo priority className="h-40 w-40 sm:h-52 sm:w-52" />
        <div className="max-w-2xl space-y-5">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-electric-300">
            Development preview
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-paper sm:text-5xl">
            A marketplace foundation, still in development.
          </h1>
          <p className="text-lg leading-8 text-mist">
            PrizeSpark is being built as a marketplace. This preview only lets
            you create an account, sign in, and — for an administrator — review
            who has access and an activity log. Seller tools are not included.
            Nothing on this site is live or legally approved, and it cannot move
            real money or award real prizes.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/signup"
              className="inline-flex h-11 items-center rounded-full bg-electric-500 px-5 text-sm font-semibold text-navy-950 hover:bg-electric-400"
            >
              Create account
            </Link>
            <Link
              href="/login"
              className="inline-flex h-11 items-center rounded-full border border-white/15 px-5 text-sm font-semibold text-paper hover:border-electric-400"
            >
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="mt-16 grid gap-4 md:grid-cols-3" aria-label="What this preview includes">
        <Card
          title="Accounts"
          body="Email and password are the only way to sign in. Your session stays on the server."
        />
        <Card
          title="Roles"
          body="New accounts are buyers. Seller and administrator are access levels only. You cannot change your own role."
        />
        <Card
          title="Activity log"
          body="Sign-ups and role changes are recorded. The log can be read by administrators and cannot be edited or deleted from the app."
        />
      </section>
    </div>
  );
}

function Card({ title, body }: { title: string; body: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-navy-900 p-6">
      <h2 className="text-lg font-semibold text-paper">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-mist">{body}</p>
    </article>
  );
}
