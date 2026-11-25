import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";
import {
  bootstrapRole,
  connectDatabase,
  createConfirmedUser,
  loadEnv,
  serviceClient,
  signIn,
} from "./helpers.mjs";

loadEnv();

const password = "Test-only-pass-1";
const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;

const emails = {
  buyer: `buyer-${stamp}@example.test`,
  other: `other-${stamp}@example.test`,
  seller: `seller-${stamp}@example.test`,
  admin: `admin-${stamp}@example.test`,
};

const ids = {};
let db;
let adminApi;
let buyer;
let other;
let seller;
let admin;

describe("row level security and audit log", { concurrency: false }, () => {
  before(async () => {
    adminApi = serviceClient();
    db = await connectDatabase();

    for (const key of ["buyer", "other", "seller", "admin"]) {
      const user = await createConfirmedUser(adminApi, {
        email: emails[key],
        password,
        displayName: `Fake ${key}`,
      });
      ids[key] = user.id;
    }

    await bootstrapRole(db, ids.admin, "admin");
    await bootstrapRole(db, ids.seller, "seller");
    await db.query("select set_config('request.jwt.claims', $1, false)", [
      JSON.stringify({ sub: ids.admin, role: "authenticated" }),
    ]);

    buyer = await signIn(emails.buyer, password);
    other = await signIn(emails.other, password);
    seller = await signIn(emails.seller, password);
    admin = await signIn(emails.admin, password);
  });

  after(async () => {
    for (const id of Object.values(ids)) {
      await adminApi.auth.admin.deleteUser(id);
    }
    await db.end();
  });

  test("a buyer can read only their own profile", async () => {
    const { data, error } = await buyer.from("profiles").select("id, email, role");
    assert.equal(error, null);
    assert.equal(data.length, 1);
    assert.equal(data[0].id, ids.buyer);
    assert.equal(data[0].role, "buyer");
  });

  test("a buyer cannot read another profile by id", async () => {
    const { data, error } = await buyer.from("profiles").select("id").eq("id", ids.other);
    assert.equal(error, null);
    assert.equal(data.length, 0);
  });

  test("a buyer cannot change another profile", async () => {
    const { error } = await buyer
      .from("profiles")
      .update({ display_name: "Hijacked" })
      .eq("id", ids.other);
    assert.equal(error, null);

    const row = await db.query("select display_name from public.profiles where id = $1", [ids.other]);
    assert.equal(row.rows[0].display_name, "Fake other");
  });

  test("a buyer cannot change their own role", async () => {
    const update = await buyer.from("profiles").update({ role: "admin" }).eq("id", ids.buyer);
    assert.ok(update.error, "role column update should be rejected");

    const rpc = await buyer.rpc("set_user_role", {
      target_user_id: ids.buyer,
      new_role: "admin",
    });
    assert.ok(rpc.error, "set_user_role should reject a buyer");
    assert.match(rpc.error.message, /only an admin/i);

    const row = await db.query("select role from public.profiles where id = $1", [ids.buyer]);
    assert.equal(row.rows[0].role, "buyer");
  });

  test("a buyer can rename only their own profile", async () => {
    const { error } = await buyer
      .from("profiles")
      .update({ display_name: "Buyer renamed" })
      .eq("id", ids.buyer);
    assert.equal(error, null);

    const row = await db.query("select display_name, role from public.profiles where id = $1", [ids.buyer]);
    assert.equal(row.rows[0].display_name, "Buyer renamed");
    assert.equal(row.rows[0].role, "buyer");
  });

  test("a seller cannot read other profiles or the activity log", async () => {
    const profiles = await seller.from("profiles").select("id");
    assert.equal(profiles.error, null);
    assert.deepEqual(profiles.data.map((row) => row.id), [ids.seller]);

    const audit = await seller.from("audit_events").select("id");
    assert.equal(audit.error, null);
    assert.equal(audit.data.length, 0);
  });

  test("a non-admin cannot call the chain check or insert an audit row", async () => {
    const verify = await other.rpc("verify_audit_chain");
    assert.ok(verify.error);

    const insert = await other.from("audit_events").insert({
      action: "user.signup",
      entity_type: "profile",
      entity_id: ids.other,
    });
    assert.ok(insert.error);
  });

  test("an admin can list people, change a role, and read the log", async () => {
    const people = await admin.from("profiles").select("id, role");
    assert.equal(people.error, null);
    assert.ok(people.data.length >= 4);

    const change = await admin.rpc("set_user_role", {
      target_user_id: ids.other,
      new_role: "seller",
    });
    assert.equal(change.error, null);

    const role = await db.query("select role from public.profiles where id = $1", [ids.other]);
    assert.equal(role.rows[0].role, "seller");

    const audit = await admin
      .from("audit_events")
      .select("action, actor_id, after_state")
      .eq("entity_id", ids.other)
      .eq("action", "role.change");
    assert.equal(audit.error, null);
    assert.ok(audit.data.length >= 1);
    assert.equal(audit.data.some((row) => row.actor_id === ids.admin), true);

    const chain = await admin.rpc("verify_audit_chain");
    assert.equal(chain.error, null);
    assert.equal(chain.data[0].is_valid, true);
  });

  test("the last administrator cannot be removed", async () => {
    const others = await db.query(
      "select id from public.profiles where role = 'admin' and id <> $1",
      [ids.admin],
    );

    for (const otherAdmin of others.rows) {
      const demoted = await admin.rpc("set_user_role", {
        target_user_id: otherAdmin.id,
        new_role: "buyer",
      });
      assert.equal(demoted.error, null);
    }

    const { error } = await admin.rpc("set_user_role", {
      target_user_id: ids.admin,
      new_role: "buyer",
    });
    assert.ok(error);
    assert.match(error.message, /last admin/i);

    const row = await db.query("select role from public.profiles where id = $1", [ids.admin]);
    assert.equal(row.rows[0].role, "admin");

    for (const otherAdmin of others.rows) {
      const restored = await admin.rpc("set_user_role", {
        target_user_id: otherAdmin.id,
        new_role: "admin",
      });
      assert.equal(restored.error, null);
    }
  });

  test("nobody, including the database owner and an admin, can update or delete the log", async () => {
    const event = await db.query("select id from public.audit_events order by chain_position desc limit 1");
    const id = event.rows[0].id;

    await assert.rejects(
      db.query("update public.audit_events set action = 'tamper' where id = $1", [id]),
      /append-only/,
    );
    await assert.rejects(
      db.query("delete from public.audit_events where id = $1", [id]),
      /append-only/,
    );
    await assert.rejects(db.query("truncate public.audit_events"), /append-only/);

    const adminUpdate = await admin.from("audit_events").update({ action: "tamper" }).eq("id", id);
    const adminDelete = await admin.from("audit_events").delete().eq("id", id);
    assert.ok(adminUpdate.error);
    assert.ok(adminDelete.error);

    const stillThere = await db.query("select action from public.audit_events where id = $1", [id]);
    assert.notEqual(stillThere.rows[0].action, "tamper");
  });

  test("a direct insert into the log is rejected, and a tampered row is detectable", async () => {
    await assert.rejects(
      db.query(
        "insert into public.audit_events (actor_id, action, entity_type, entity_id) values ($1, 'user.signup', 'profile', $2)",
        [ids.admin, ids.admin],
      ),
      /write_audit_event/,
    );

    await db.query("begin");
    try {
      await db.query("alter table public.audit_events disable trigger audit_events_no_update");
      await db.query(
        "update public.audit_events set action = 'tamper' where chain_position = (select min(chain_position) from public.audit_events)",
      );
      const broken = await db.query("select is_valid from public.verify_audit_chain()");
      assert.equal(broken.rows[0].is_valid, false);
    } finally {
      await db.query("rollback");
    }

    const restored = await db.query("select is_valid from public.verify_audit_chain()");
    assert.equal(restored.rows[0].is_valid, true);
  });
});
