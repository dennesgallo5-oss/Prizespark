import { Suspense } from "react";
import { RoleBadge } from "@/components/role-badge";
import { RoleForm } from "@/components/role-form";
import { listAuditEvents, listProfiles, readAuditChain } from "@/server/data/admin";
import { requireRole } from "@/server/auth/session";
import type { AuditEvent } from "@/lib/types";

export const metadata = {
  title: "Admin",
};

export default function AdminPage() {
  return (
    <Suspense fallback={<AdminFallback />}>
      <AdminScreen />
    </Suspense>
  );
}

async function AdminScreen() {
  await requireRole("admin");
  const [profiles, events, chain] = await Promise.all([
    listProfiles(),
    listAuditEvents(),
    readAuditChain(),
  ]);
  const emails = new Map(profiles.map((profile) => [profile.id, profile.email]));

  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-paper">Admin</h1>
      <p className="mt-2 max-w-3xl text-mist">
        Change a person&apos;s role, or read the activity log. Role changes are
        recorded. Log rows cannot be edited or deleted.
      </p>

      <section className="mt-8">
        <h2 className="text-xl font-semibold text-paper">People</h2>
        <p className="mt-1 text-sm text-mist-dim">
          Showing up to 200 accounts. Saving a role writes an activity-log entry.
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-navy-900 text-mist-dim">
              <tr>
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Email</th>
                <th className="px-4 py-3 font-medium">Role</th>
                <th className="px-4 py-3 font-medium">Change role</th>
              </tr>
            </thead>
            <tbody>
              {profiles.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-mist" colSpan={4}>
                    No accounts yet.
                  </td>
                </tr>
              ) : (
                profiles.map((profile) => (
                  <tr key={profile.id} className="border-t border-white/10 align-top">
                    <td className="px-4 py-4 text-paper">{profile.display_name}</td>
                    <td className="px-4 py-4 text-mist">{profile.email}</td>
                    <td className="px-4 py-4">
                      <RoleBadge role={profile.role} />
                    </td>
                    <td className="px-4 py-4">
                      <RoleForm userId={profile.id} role={profile.role} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-12">
        <h2 className="text-xl font-semibold text-paper">Activity log</h2>
        <p
          className={`mt-3 rounded-xl px-4 py-3 text-sm ${
            chain.is_valid
              ? "bg-electric-500/10 text-electric-300"
              : "bg-orange-500/15 text-orange-300"
          }`}
          role="status"
        >
          {chain.is_valid
            ? `Hash chain intact. ${chain.checked_count} event${chain.checked_count === 1 ? "" : "s"} checked.`
            : `Hash chain broken at event ${chain.first_broken_id ?? "unknown"} after checking ${chain.checked_count}.`}
        </p>
        <div className="mt-4 overflow-x-auto rounded-2xl border border-white/10">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-navy-900 text-mist-dim">
              <tr>
                <th className="px-4 py-3 font-medium">When (UTC)</th>
                <th className="px-4 py-3 font-medium">Action</th>
                <th className="px-4 py-3 font-medium">Actor</th>
                <th className="px-4 py-3 font-medium">Before</th>
                <th className="px-4 py-3 font-medium">After</th>
                <th className="px-4 py-3 font-medium">Hash</th>
              </tr>
            </thead>
            <tbody>
              {events.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-mist" colSpan={6}>
                    No activity yet.
                  </td>
                </tr>
              ) : (
                events.map((event) => (
                  <AuditRow
                    key={event.id}
                    event={event}
                    actorEmail={event.actor_id ? emails.get(event.actor_id) : undefined}
                  />
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function AuditRow({
  event,
  actorEmail,
}: {
  event: AuditEvent;
  actorEmail?: string;
}) {
  const when = new Date(event.created_at)
    .toISOString()
    .replace("T", " ")
    .replace(/\.\d+Z$/, " UTC");

  return (
    <tr className="border-t border-white/10 align-top">
      <td className="px-4 py-3 whitespace-nowrap text-mist">{when}</td>
      <td className="px-4 py-3 text-paper">{event.action}</td>
      <td className="px-4 py-3 text-mist">{actorLabel(event, actorEmail)}</td>
      <td className="px-4 py-3 font-mono text-xs text-mist-dim">{formatJson(event.before_state)}</td>
      <td className="px-4 py-3 font-mono text-xs text-mist-dim">{formatJson(event.after_state)}</td>
      <td className="px-4 py-3 font-mono text-xs text-mist-dim" title={event.row_hash}>
        {event.row_hash.slice(0, 12)}…
      </td>
    </tr>
  );
}

function actorLabel(event: AuditEvent, actorEmail?: string): string {
  if (actorEmail) {
    return actorEmail;
  }
  const via = event.after_state?.via;
  if (via === "local-seed") {
    return "Local seed script";
  }
  if (via === "sql-editor") {
    return "SQL editor";
  }
  return "No account email on this row";
}

function formatJson(value: Record<string, unknown> | null): string {
  if (!value) {
    return "—";
  }
  return JSON.stringify(value);
}

function AdminFallback() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-semibold text-paper">Admin</h1>
      <p className="mt-3 text-sm text-mist-dim">Loading…</p>
    </div>
  );
}
