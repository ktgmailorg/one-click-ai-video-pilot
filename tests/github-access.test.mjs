import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync } from "node:crypto";
import { parseGithubAppPrivateKey } from "../lib/github-access.mjs";

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
