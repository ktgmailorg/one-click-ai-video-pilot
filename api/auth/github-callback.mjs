import {
  clearOauthStateCookie,
  identityDigest,
  oauthStateFromRequest,
  redirectResponse,
  requestOrigin,
  requireMethod,
  sessionFromRequest,
  setSessionCookie,
  verifySignedValue,
} from "../../lib/auth.mjs";
import {
  exchangeGithubCode,
  githubIdentity,
  inviteVerifiedGithubUser,
} from "../../lib/github-access.mjs";

export default async function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const origin = requestOrigin(request);
  try {
    const session = sessionFromRequest(request);
    if (!session) {
      redirectResponse(response, "/rit-access.html?error=rit_required");
      return;
    }
    const url = new URL(request.url, origin);
    const code = url.searchParams.get("code");
    const stateValue = url.searchParams.get("state");
    const cookieState = oauthStateFromRequest(request, "github");
    const queryState = verifySignedValue(stateValue, "oauth-state");
    if (
      !code ||
      !cookieState ||
      !queryState ||
      queryState.provider !== "github" ||
      queryState.nonce !== cookieState.nonce ||
      queryState.ritIdentity !== identityDigest(session.email)
    ) {
      throw new Error("The GitHub authorization state could not be verified");
    }
    const redirectUri = `${origin}/api/auth/github-callback`;
    const userToken = await exchangeGithubCode({
      code,
      redirectUri,
      signal: AbortSignal.timeout(15_000),
    });
    const github = await githubIdentity(userToken, {
      signal: AbortSignal.timeout(15_000),
    });
    const access = await inviteVerifiedGithubUser({
      login: github.login,
      ritEmail: session.email,
      signal: AbortSignal.timeout(15_000),
    });
    setSessionCookie(response, {
      ...session,
      githubLogin: github.login,
    });
    clearOauthStateCookie(response);
    redirectResponse(
      response,
      `/rit-access.html?github=${encodeURIComponent(access.status)}`,
    );
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "github-access-failed",
        code: error.code || "ACCESS_FAILED",
      }),
    );
    clearOauthStateCookie(response);
    redirectResponse(response, "/rit-access.html?error=github_access");
  }
}
