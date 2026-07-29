import {
  clearOauthStateCookie,
  clearSessionCookie,
  jsonResponse,
  requireMethod,
} from "../../lib/auth.mjs";

export default function handler(request, response) {
  if (!requireMethod(request, response, ["POST"])) return;
  clearSessionCookie(response);
  clearOauthStateCookie(response);
  jsonResponse(response, 200, { signedOut: true });
}
