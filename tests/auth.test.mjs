import assert from "node:assert/strict";
import { after, describe, test } from "node:test";
import {
  connectDatabase,
  loadEnv,
  publicClient,
  serviceClient,
} from "./helpers.mjs";

loadEnv();

const stamp = `${Date.now()}-${Math.floor(Math.random() * 10000)}`;
const email = `signup-${stamp}@example.test`;
const password = "Test-only-pass-1";
let userId;

describe("email and password auth", { concurrency: false }, () => {
  after(async () => {
    if (!userId) {
      return;
    }
    const admin = serviceClient();
    await admin.auth.admin.deleteUser(userId);
  });

  test("sign up creates a buyer profile and an activity-log row", async () => {
    const client = publicClient();
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: { data: { display_name: "Signup Tester" } },
    });

    assert.equal(error, null);
    assert.ok(data.session, "local auth should return a session when email confirmation is off");
    assert.ok(data.user);
    userId = data.user.id;

    const profile = await client
      .from("profiles")
      .select("email, display_name, role")
      .eq("id", userId)
      .single();
    assert.equal(profile.error, null);
    assert.equal(profile.data.role, "buyer");
    assert.equal(profile.data.display_name, "Signup Tester");
    assert.equal(profile.data.email, email);

    const db = await connectDatabase();
    try {
      const audit = await db.query(
        "select action, actor_id, after_state->>'role' as role from public.audit_events where entity_id = $1 and action = 'user.signup'",
        [userId],
      );
      assert.equal(audit.rows.length, 1);
      assert.equal(audit.rows[0].actor_id, userId);
      assert.equal(audit.rows[0].role, "buyer");
    } finally {
      await db.end();
    }
  });

  test("wrong password is rejected and sign out clears the session", async () => {
    const wrong = publicClient();
    const denied = await wrong.auth.signInWithPassword({
      email,
      password: "not-the-password",
    });
    assert.ok(denied.error);
    assert.equal(denied.data.session, null);

    const client = publicClient();
    const signedIn = await client.auth.signInWithPassword({ email, password });
    assert.equal(signedIn.error, null);
    assert.ok(signedIn.data.session);

    const { error: signOutError } = await client.auth.signOut();
    assert.equal(signOutError, null);

    const { data, error } = await client.auth.getUser();
    assert.equal(data.user, null);
    assert.ok(error);
  });

  test("signing in again works after sign out", async () => {
    const client = publicClient();
    const signedIn = await client.auth.signInWithPassword({ email, password });
    assert.equal(signedIn.error, null);
    const user = await client.auth.getUser();
    assert.equal(user.data.user?.email, email);
  });
});
