import { createPrivateKey } from "node:crypto";
import { SignJWT } from "jose";
import { identityDigest } from "./auth.mjs";

export async function exchangeGithubCode({
  code,
  redirectUri,
  signal,
}) {
  const response = await fetch(
    "https://github.com/login/oauth/access_token",
    {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        client_id: process.env.GITHUB_CLIENT_ID,
        client_secret: process.env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: redirectUri,
      }),
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok || !result.access_token) {
    throw new Error(
      result.error_description || "GitHub authorization could not be completed",
    );
  }
  return result.access_token;
}

export async function githubIdentity(accessToken, { signal } = {}) {
  const response = await githubRequest("/user", {
    token: accessToken,
    signal,
  });
  if (!response.login || !response.id) {
    throw new Error("GitHub did not return a verified account identity");
  }
  return {
    id: response.id,
    login: response.login,
    name: response.name || response.login,
  };
}

export async function inviteVerifiedGithubUser({
  login,
  ritEmail,
  signal,
}) {
  const token = await repositoryAdministrationToken({ signal });
  const repository =
    process.env.GITHUB_REPOSITORY || "ktgmailorg/video-generator-rit";
  const response = await fetch(
    `https://api.github.com/repos/${repository}/collaborators/${encodeURIComponent(login)}`,
    {
      method: "PUT",
      headers: githubHeaders(token),
      body: JSON.stringify({ permission: "pull" }),
      signal,
    },
  );
  if (![201, 204].includes(response.status)) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(
      errorBody.message ||
        `GitHub repository invitation failed with HTTP ${response.status}`,
    );
  }
  const status = response.status === 201 ? "invited" : "already-authorized";
  console.log(
    JSON.stringify({
      event: "github-read-access",
      ritIdentity: identityDigest(ritEmail),
      githubLogin: login,
      repository,
      status,
    }),
  );
  return { status, repository };
}

async function repositoryAdministrationToken({ signal } = {}) {
  if (process.env.GITHUB_REPO_ADMIN_TOKEN) {
    return process.env.GITHUB_REPO_ADMIN_TOKEN;
  }
  const appId = process.env.GITHUB_APP_ID;
  const installationId = process.env.GITHUB_APP_INSTALLATION_ID;
  const privateKeyValue = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!appId || !installationId || !privateKeyValue) {
    throw new Error("GitHub repository invitation is not configured");
  }
  const privateKey = parseGithubAppPrivateKey(privateKeyValue);
  const now = Math.floor(Date.now() / 1000);
  const appJwt = await new SignJWT({})
    .setProtectedHeader({ alg: "RS256" })
    .setIssuedAt(now - 30)
    .setExpirationTime(now + 8 * 60)
    .setIssuer(String(appId))
    .sign(privateKey);
  const response = await fetch(
    `https://api.github.com/app/installations/${encodeURIComponent(installationId)}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(appJwt),
      signal,
    },
  );
  const result = await response.json();
  if (!response.ok || !result.token) {
    throw new Error(
      result.message || "Could not obtain a GitHub App installation token",
    );
  }
  return result.token;
}

export function parseGithubAppPrivateKey(value) {
  return createPrivateKey(String(value).replace(/\\n/g, "\n"));
}

async function githubRequest(path, { token, signal }) {
  const response = await fetch(`https://api.github.com${path}`, {
    headers: githubHeaders(token),
    signal,
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.message || `GitHub returned HTTP ${response.status}`);
  }
  return result;
}

function githubHeaders(token) {
  return {
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "user-agent": "rit-one-click-ai-video-access",
    "x-github-api-version": "2022-11-28",
  };
}
