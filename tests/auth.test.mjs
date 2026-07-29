import test from "node:test";
import assert from "node:assert/strict";
import {
  assertRitGoogleClaims,
  authenticationConfiguration,
  createSignedValue,
  sessionFromRequest,
  setSessionCookie,
  verifySignedValue,
} from "../lib/auth.mjs";

const originalEnvironment = { ...process.env };

test.afterEach(() => {
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

test("signed sessions reject modification and expiration", () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const value = createSignedValue(
    { email: "faculty@rit.edu" },
    "session",
    60,
  );
  assert.equal(
    verifySignedValue(value, "session").email,
    "faculty@rit.edu",
  );
  assert.equal(verifySignedValue(`${value}x`, "session"), null);
  assert.equal(verifySignedValue(value, "oauth-state"), null);
});

test("session cookies are secure and readable server-side", () => {
  process.env.SESSION_SECRET = "s".repeat(48);
  const headers = new Map();
  const response = {
    getHeader: (name) => headers.get(name),
    setHeader: (name, value) => headers.set(name, value),
  };
  setSessionCookie(response, {
    email: "faculty@rit.edu",
    name: "Faculty Member",
    googleSubject: "google-123",
  });
  const cookie = headers.get("set-cookie");
  assert.match(cookie, /HttpOnly/);
  assert.match(cookie, /Secure/);
  assert.match(cookie, /SameSite=Lax/);
  const request = { headers: { cookie: cookie.split(";")[0] } };
  assert.equal(sessionFromRequest(request).email, "faculty@rit.edu");
});

test("RIT Google verification accepts the RIT Google alias domain", () => {
  const identity = assertRitGoogleClaims(
    {
      email: "FACULTY@G.RIT.EDU",
      email_verified: true,
      hd: "rit.edu",
      nonce: "expected",
      sub: "google-123",
      name: "Faculty Member",
    },
    "expected",
  );
  assert.equal(identity.email, "faculty@g.rit.edu");
});

test("RIT Google verification requires the hosted domain and nonce", () => {
  assert.throws(
    () =>
      assertRitGoogleClaims(
        {
          email: "faculty@gmail.com",
          email_verified: true,
          nonce: "expected",
          sub: "google-123",
        },
        "expected",
      ),
    /verified for rit\.edu/i,
  );
  assert.throws(
    () =>
      assertRitGoogleClaims(
        {
          email: "faculty@notrit.edu",
          email_verified: true,
          hd: "rit.edu",
          nonce: "expected",
          sub: "google-123",
        },
        "expected",
      ),
    /verified for rit\.edu/i,
  );
  assert.throws(
    () =>
      assertRitGoogleClaims(
        {
          email: "faculty@rit.edu",
          email_verified: true,
          hd: "rit.edu",
          nonce: "wrong",
          sub: "google-123",
        },
        "expected",
      ),
    /could not be verified/i,
  );
});

test("authentication stays disabled until every credential is present", () => {
  for (const key of [
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
    "GITHUB_APP_ID",
    "GITHUB_APP_INSTALLATION_ID",
    "GITHUB_APP_PRIVATE_KEY",
    "GITHUB_REPO_ADMIN_TOKEN",
    "SESSION_SECRET",
    "AUTH_BASE_URL",
  ]) {
    delete process.env[key];
  }
  assert.deepEqual(authenticationConfiguration(), {
    googleConfigured: false,
    githubConfigured: false,
    repository: "ktgmailorg/video-generator-rit",
  });
  Object.assign(process.env, {
    GOOGLE_CLIENT_ID: "google-client",
    GOOGLE_CLIENT_SECRET: "google-secret",
    GITHUB_CLIENT_ID: "github-client",
    GITHUB_CLIENT_SECRET: "github-secret",
    GITHUB_APP_ID: "1",
    GITHUB_APP_INSTALLATION_ID: "2",
    GITHUB_APP_PRIVATE_KEY: "private-key",
    SESSION_SECRET: "s".repeat(48),
    AUTH_BASE_URL: "https://one-click-ai-video-pilot.vercel.app",
  });
  assert.deepEqual(authenticationConfiguration(), {
    googleConfigured: true,
    githubConfigured: true,
    repository: "ktgmailorg/video-generator-rit",
  });
});
