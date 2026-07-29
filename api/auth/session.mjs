import {
  authenticationConfiguration,
  jsonResponse,
  requireMethod,
  sessionFromRequest,
} from "../../lib/auth.mjs";

export default function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const session = sessionFromRequest(request);
  jsonResponse(response, 200, {
    authenticated: Boolean(session),
    configuration: authenticationConfiguration(),
    identity: session
      ? {
          email: session.email,
          name: session.name,
          githubLogin: session.githubLogin || null,
        }
      : null,
    resources: session
      ? {
          repository:
            process.env.GITHUB_REPOSITORY ||
            "ktgmailorg/video-generator-rit",
          localStudio: "http://127.0.0.1:4173",
          professorGuide: "/professor-guide.html",
        }
      : null,
  });
}
