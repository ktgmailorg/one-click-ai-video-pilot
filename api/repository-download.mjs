import {
  jsonResponse,
  redirectResponse,
  requireMethod,
  sessionFromRequest,
} from "../lib/auth.mjs";
import { repositoryArchiveLocation } from "../lib/github-access.mjs";

export default async function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const session = sessionFromRequest(request);
  if (!session) {
    jsonResponse(response, 401, {
      error: "Verify your RIT Google account before downloading the source",
    });
    return;
  }
  try {
    const location = await repositoryArchiveLocation({
      ritEmail: session.email,
      signal: AbortSignal.timeout(15_000),
    });
    response.setHeader("content-security-policy", "default-src 'none'");
    redirectResponse(response, location);
  } catch (error) {
    console.error(
      JSON.stringify({
        event: "rit-repository-download-failed",
        message: error.message,
      }),
    );
    jsonResponse(response, 503, {
      error: "The repository download is temporarily unavailable",
    });
  }
}
