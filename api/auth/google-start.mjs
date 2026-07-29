import {
  authenticationConfiguration,
  jsonResponse,
  randomNonce,
  redirectResponse,
  requestOrigin,
  requireMethod,
  setOauthStateCookie,
} from "../../lib/auth.mjs";

export default function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  if (!authenticationConfiguration().googleConfigured) {
    jsonResponse(response, 503, {
      error: "RIT Google sign-in is awaiting administrator activation",
    });
    return;
  }
  const origin = requestOrigin(request);
  const nonce = randomNonce();
  const state = setOauthStateCookie(response, {
    provider: "google",
    nonce,
  });
  const authorization = new URL(
    "https://accounts.google.com/o/oauth2/v2/auth",
  );
  authorization.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID);
  authorization.searchParams.set(
    "redirect_uri",
    `${origin}/api/auth/google-callback`,
  );
  authorization.searchParams.set("response_type", "code");
  authorization.searchParams.set("scope", "openid email profile");
  authorization.searchParams.set("hd", "g.rit.edu");
  authorization.searchParams.set("nonce", nonce);
  authorization.searchParams.set("state", state);
  authorization.searchParams.set("prompt", "select_account");
  redirectResponse(response, authorization.toString());
}
