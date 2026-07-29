import {
  authenticationConfiguration,
  identityDigest,
  jsonResponse,
  randomNonce,
  redirectResponse,
  requestOrigin,
  requireMethod,
  sessionFromRequest,
  setOauthStateCookie,
} from "../../lib/auth.mjs";

export default function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const session = sessionFromRequest(request);
  if (!session) {
    redirectResponse(response, "/rit-access.html?error=rit_required");
    return;
  }
  if (!authenticationConfiguration().githubConfigured) {
    jsonResponse(response, 503, {
      error: "GitHub access automation is awaiting administrator activation",
    });
    return;
  }
  const origin = requestOrigin(request);
  const state = setOauthStateCookie(response, {
    provider: "github",
    nonce: randomNonce(),
    ritIdentity: identityDigest(session.email),
  });
  const authorization = new URL("https://github.com/login/oauth/authorize");
  authorization.searchParams.set("client_id", process.env.GITHUB_CLIENT_ID);
  authorization.searchParams.set(
    "redirect_uri",
    `${origin}/api/auth/github-callback`,
  );
  authorization.searchParams.set("scope", "read:user user:email");
  authorization.searchParams.set("state", state);
  redirectResponse(response, authorization.toString());
}
