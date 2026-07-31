import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import {
  parseGithubAppPrivateKey,
  repositoryArchiveLocation,
} from "../lib/github-access.mjs";

const originalFetch = globalThis.fetch;
const originalEnvironment = { ...process.env };

test.afterEach(() => {
  globalThis.fetch = originalFetch;
  for (const key of Object.keys(process.env)) {
    if (!(key in originalEnvironment)) delete process.env[key];
  }
  Object.assign(process.env, originalEnvironment);
});

test("GitHub App signing accepts GitHub's PKCS#1 private-key format", () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const pkcs1 = privateKey.export({
    format: "pem",
    type: "pkcs1",
  });

  const parsed = parseGithubAppPrivateKey(pkcs1);

  assert.equal(parsed.type, "private");
  assert.equal(parsed.asymmetricKeyType, "rsa");
});

test("GitHub App signing accepts escaped PEM line breaks", () => {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const escapedPkcs1 = privateKey
    .export({ format: "pem", type: "pkcs1" })
    .replace(/\n/g, "\\n");

  const parsed = parseGithubAppPrivateKey(escapedPkcs1);

  assert.equal(parsed.type, "private");
  assert.equal(parsed.asymmetricKeyType, "rsa");
});

test("verified RIT downloads receive a temporary GitHub archive location", async () => {
  process.env.GITHUB_REPO_ADMIN_TOKEN = "repository-token";
  process.env.GITHUB_REPOSITORY = "ktgmailorg/video-generator-rit";
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url, options };
    return new Response(null, {
      status: 302,
      headers: { location: "https://objects.example/archive.zip" },
    });
  };

  const location = await repositoryArchiveLocation({
    ritEmail: "faculty@rit.edu",
  });

  assert.equal(location, "https://objects.example/archive.zip");
  assert.equal(
    request.url,
    "https://api.github.com/repos/ktgmailorg/video-generator-rit/zipball/main",
  );
  assert.equal(request.options.redirect, "manual");
  assert.equal(
    request.options.headers.authorization,
    "Bearer repository-token",
  );
});
