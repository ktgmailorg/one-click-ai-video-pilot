import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const sessionCookieName = "rit_video_session";
const oauthCookieName = "rit_video_oauth";

export function authenticationConfiguration() {
  const sessionConfigured =
    Boolean(process.env.SESSION_SECRET) &&
    Buffer.byteLength(process.env.SESSION_SECRET) >= 32;
  const originConfigured = /^https:\/\/[^/]+$/i.test(
    process.env.AUTH_BASE_URL || "",
  );
  const googleConfigured = hasEnvironment([
    "GOOGLE_CLIENT_ID",
    "GOOGLE_CLIENT_SECRET",
  ]) && sessionConfigured && originConfigured;
  const githubIdentityConfigured = hasEnvironment([
    "GITHUB_CLIENT_ID",
    "GITHUB_CLIENT_SECRET",
  ]) && sessionConfigured && originConfigured;
  const githubInvitationConfigured =
    hasEnvironment([
      "GITHUB_APP_ID",
      "GITHUB_APP_INSTALLATION_ID",
      "GITHUB_APP_PRIVATE_KEY",
    ]) || Boolean(process.env.GITHUB_REPO_ADMIN_TOKEN);
  return {
    googleConfigured,
    repositoryDownloadConfigured: githubInvitationConfigured,
    githubConfigured:
      githubIdentityConfigured && githubInvitationConfigured,
    repository:
      process.env.GITHUB_REPOSITORY || "ktgmailorg/video-generator-rit",
  };
}

export function requestOrigin(request) {
  if (process.env.AUTH_BASE_URL) {
    return process.env.AUTH_BASE_URL.replace(/\/+$/, "");
  }
  const protocol =
    firstHeader(request.headers["x-forwarded-proto"]) ||
    (request.socket?.encrypted ? "https" : "http");
  const host =
    firstHeader(request.headers["x-forwarded-host"]) ||
    firstHeader(request.headers.host);
  if (!host) throw new Error("Request host is unavailable");
  return `${protocol}://${host}`;
}

export function randomNonce() {
  return randomBytes(24).toString("base64url");
}

export function createSignedValue(payload, purpose, lifetimeSeconds) {
  const now = Math.floor(Date.now() / 1000);
  const body = Buffer.from(
    JSON.stringify({
      ...payload,
      purpose,
      iat: now,
      exp: now + lifetimeSeconds,
    }),
  ).toString("base64url");
  return `${body}.${signature(body)}`;
}

export function verifySignedValue(value, purpose) {
  if (!value || typeof value !== "string") return null;
  const [body, suppliedSignature, extra] = value.split(".");
  if (!body || !suppliedSignature || extra) return null;
  const expected = signature(body);
  const suppliedBytes = Buffer.from(suppliedSignature);
  const expectedBytes = Buffer.from(expected);
  if (
    suppliedBytes.length !== expectedBytes.length ||
    !timingSafeEqual(suppliedBytes, expectedBytes)
  ) {
    return null;
  }
  let payload;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
  } catch {
    return null;
  }
  const now = Math.floor(Date.now() / 1000);
  if (payload.purpose !== purpose || payload.exp < now) return null;
  return payload;
}

export function sessionFromRequest(request) {
  const cookies = parseCookies(request.headers.cookie);
  return verifySignedValue(cookies[sessionCookieName], "session");
}

export function oauthStateFromRequest(request, expectedProvider) {
  const cookies = parseCookies(request.headers.cookie);
  const state = verifySignedValue(cookies[oauthCookieName], "oauth-state");
  if (!state || state.provider !== expectedProvider) return null;
  return state;
}

export function setSessionCookie(response, identity) {
  const value = createSignedValue(
    {
      email: identity.email,
      name: identity.name || identity.email,
      googleSubject: identity.googleSubject,
      ...(identity.githubLogin
        ? { githubLogin: identity.githubLogin }
        : {}),
    },
    "session",
    8 * 60 * 60,
  );
  appendCookie(
    response,
    serializeCookie(sessionCookieName, value, {
      maxAge: 8 * 60 * 60,
      secure: true,
    }),
  );
}

export function setOauthStateCookie(response, state) {
  const value = createSignedValue(state, "oauth-state", 10 * 60);
  appendCookie(
    response,
    serializeCookie(oauthCookieName, value, {
      maxAge: 10 * 60,
      secure: true,
    }),
  );
  return value;
}

export function clearOauthStateCookie(response) {
  appendCookie(
    response,
    serializeCookie(oauthCookieName, "", { maxAge: 0, secure: true }),
  );
}

export function clearSessionCookie(response) {
  appendCookie(
    response,
    serializeCookie(sessionCookieName, "", { maxAge: 0, secure: true }),
  );
}

export function assertRitGoogleClaims(payload, expectedNonce) {
  const email = String(payload.email || "").toLowerCase();
  const hostedDomain = String(payload.hd || "").toLowerCase();
  const hasRitHostedDomain = ["rit.edu", "g.rit.edu"].includes(hostedDomain);
  const hasRitEmailDomain = ["rit.edu", "g.rit.edu"].some((domain) =>
    email.endsWith(`@${domain}`),
  );
  if (
    payload.email_verified !== true ||
    !hasRitHostedDomain ||
    !hasRitEmailDomain
  ) {
    const error = new Error(
      "Sign in with a verified RIT Google Workspace account",
    );
    error.code = "RIT_ACCOUNT_REQUIRED";
    throw error;
  }
  if (payload.nonce !== expectedNonce) {
    const error = new Error("The Google sign-in request could not be verified");
    error.code = "OAUTH_STATE_INVALID";
    throw error;
  }
  return {
    email,
    name: String(payload.name || email).slice(0, 160),
    googleSubject: String(payload.sub),
  };
}

export function identityDigest(value) {
  return createHash("sha256")
    .update(String(value).toLowerCase())
    .digest("hex")
    .slice(0, 16);
}

export function jsonResponse(response, status, value) {
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.setHeader("cache-control", "no-store");
  response.setHeader("x-content-type-options", "nosniff");
  response.end(`${JSON.stringify(value)}\n`);
}

export function redirectResponse(response, location) {
  response.statusCode = 302;
  response.setHeader("cache-control", "no-store");
  response.setHeader("location", location);
  response.end();
}

export function requireMethod(request, response, methods) {
  if (methods.includes(request.method)) return true;
  response.setHeader("allow", methods.join(", "));
  jsonResponse(response, 405, { error: "Method not allowed" });
  return false;
}

function hasEnvironment(names) {
  return names.every((name) => Boolean(process.env[name]));
}

function signature(body) {
  const secret = process.env.SESSION_SECRET;
  if (!secret || Buffer.byteLength(secret) < 32) {
    throw new Error("SESSION_SECRET must contain at least 32 bytes");
  }
  return createHmac("sha256", secret).update(body).digest("base64url");
}

function parseCookies(header = "") {
  return Object.fromEntries(
    String(header)
      .split(";")
      .map((value) => value.trim())
      .filter(Boolean)
      .map((value) => {
        const index = value.indexOf("=");
        if (index < 0) return [value, ""];
        return [
          decodeURIComponent(value.slice(0, index)),
          decodeURIComponent(value.slice(index + 1)),
        ];
      }),
  );
}

function serializeCookie(name, value, { maxAge, secure }) {
  return [
    `${encodeURIComponent(name)}=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Lax",
    secure ? "Secure" : null,
    `Max-Age=${maxAge}`,
  ]
    .filter(Boolean)
    .join("; ");
}

function appendCookie(response, value) {
  const current = response.getHeader("set-cookie");
  response.setHeader(
    "set-cookie",
    current ? [...(Array.isArray(current) ? current : [current]), value] : value,
  );
}

function firstHeader(value) {
  return Array.isArray(value) ? value[0] : String(value || "").split(",")[0];
}
