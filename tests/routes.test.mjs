import assert from "node:assert/strict";
import { describe, test } from "node:test";

const base = process.env.BASE_URL;

describe("preview routes", { concurrency: false }, () => {
  test("landing page shows the development preview notice", async (t) => {
    if (!base) {
      t.skip("BASE_URL is not set");
      return;
    }

    const response = await fetch(base);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Development preview — simulated data, no real money or prizes/);
    assert.match(html, /Nothing on this site is live or legally approved/);
    assert.match(html, /PrizeSpark/);
    assert.doesNotMatch(html, /auctions are open|token sale|buy SPK|prizes available now/i);
  });

  test("sign-in page is public", async (t) => {
    if (!base) {
      t.skip("BASE_URL is not set");
      return;
    }

    const response = await fetch(`${base}/login`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /Sign in/);
    assert.match(html, /Development preview/);
  });

  test("account and admin pages redirect anonymous visitors to sign in", async (t) => {
    if (!base) {
      t.skip("BASE_URL is not set");
      return;
    }

    for (const path of ["/account", "/admin"]) {
      const response = await fetch(`${base}${path}`, { redirect: "manual" });
      assert.ok(response.status === 307 || response.status === 302, `${path} status ${response.status}`);
      const location = response.headers.get("location") ?? "";
      assert.match(location, /\/login/);
    }
  });
});
