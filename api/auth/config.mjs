import {
  authenticationConfiguration,
  jsonResponse,
  requireMethod,
} from "../../lib/auth.mjs";

export default function handler(request, response) {
  if (!requireMethod(request, response, ["GET"])) return;
  const configuration = authenticationConfiguration();
  jsonResponse(response, 200, {
    ...configuration,
    accessPolicy: {
      ritGoogleRequired: true,
      githubIdentityRequired: true,
      automaticPermission: "read",
      writeAccess: "manual-approval",
    },
  });
}
