import { createRemoteJWKSet, jwtVerify } from "jose";
import {
  assertRitGoogleClaims,
  authenticationConfiguration,
  clearOauthStateCookie,
  oauthStateFromRequest,
  redirectResponse,
  requestOrigin,
  requireMethod,
  setSessionCookie,
  verifySignedValue,
} from "../../lib/auth.mjs";

const googleKeys = createRemoteJWKSet(
  new URL("https://www.googleapis.com/oauth2/v3/certs"),
);

export default async function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const origin = requestOrigin(request);
  try {
    if (!authenticationConfiguration().googleConfigured) {
      throw new Error("RIT Google sign-in is not configured");
    }
    const url = new URL(request.url, origin);
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    const cookieState = oauthStateFromRequest(request, "google");
    const queryState = verifySignedValue(stateValue, "oauth-state");
    if (
      !code ||
      !cookieState ||
      !queryState ||
      queryState.provider !== "google" ||
      queryState.nonce !== cookieState.nonce
    ) {
      throw new Error("The Google sign-in state could not be verified");
    }
    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        code,
        grant_type: "authorization_code",
        redirect_uri: `${origin}/api/auth/google-callback`,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const tokens = await tokenResponse.json();
    if (!tokenResponse.ok || !tokens.id_token) {
      throw new Error(
        tokens.error_description || "Google sign-in could not be completed",
      );
    }
    const verified = await jwtVerify(tokens.id_token, googleKeys, {
      audience: process.env.GOOGLE_CLIENT_ID,
      issuer: ["https://accounts.google.com", "accounts.google.com"],
    });
    const identity = assertRitGoogleClaims(
      verified.payload,
      cookieState.nonce,
    );
    setSessionCookie(response, identity);
    clearOauthStateCookie(response);
    redirectResponse(response, "/rit-access.html?signed_in=1");
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "rit-google-sign-in-failed",
        code: error.code || "AUTH_FAILED",
      }),
    );
    clearOauthStateCookie(response);
    redirectResponse(response, "/rit-access.html?error=rit_sign_in");
  }
}
