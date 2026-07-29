# RIT Google and GitHub Access Activation

The public site contains a disabled-by-default identity flow:

1. Google verifies a signed-in `rit.edu` Workspace account.
2. GitHub verifies the exact GitHub account controlled by that person.
3. The backend sends that verified GitHub account a read-only invitation to
   `ktgmailorg/video-generator-rit`.
4. GitHub requires the user to accept the invitation.

Automatic write access is intentionally prohibited. Membership in the
`RIT Contributors` team remains a manual project-lead decision.

## Why two identity checks are required

An RIT Google identity does not identify a GitHub account. Asking someone to
type a GitHub username would let a verified RIT user invite an unrelated third
party. GitHub OAuth proves control of the account that receives the invitation.

The system does not silently inspect Google browser state. The user selects
**Continue with RIT Google** and completes Google's authorization screen. A
person already signed into their RIT account normally does not need to re-enter
their password, but the intentional confirmation remains.

## 1. Create the Google OAuth client

Use a Google Cloud project controlled by the appropriate RIT project or club
owner.

Create an OAuth 2.0 Web application with:

- Authorized JavaScript origin:
  `https://one-click-ai-video-pilot.vercel.app`
- Authorized redirect URI:
  `https://one-click-ai-video-pilot.vercel.app/api/auth/google-callback`

Where RIT Workspace administration permits it, configure the consent screen as
internal to the RIT Workspace. The application still verifies all of the
following server-side:

- Google token signature
- OAuth audience and issuer
- OAuth nonce
- `email_verified: true`
- Hosted-domain claim exactly `rit.edu`
- Email suffix exactly `@rit.edu`

Record the client ID and client secret.

## 2. Create the GitHub App

Create a GitHub App owned by `ktgmailorg`.

Use:

- Homepage:
  `https://one-click-ai-video-pilot.vercel.app`
- User authorization callback:
  `https://one-click-ai-video-pilot.vercel.app/api/auth/github-callback`
- Repository access: only `ktgmailorg/video-generator-rit`
- Repository permission: **Administration — Read and write**
- All other write permissions: none

Administration write is required only to create repository collaborator
invitations. The application always requests `permission: pull`; it never adds
the account to the write-enabled `RIT Contributors` team.

Generate:

- GitHub client ID
- GitHub client secret
- GitHub App ID
- GitHub App private key
- Installation ID for the one-repository installation

The implementation exchanges the private key for short-lived installation
tokens. A fine-grained repository token can be used temporarily, but the
GitHub App route is preferred.

## 3. Configure Vercel

Generate the session secret locally:

```bash
openssl rand -base64 48
```

Add these Vercel production environment variables:

```text
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
GITHUB_CLIENT_ID
GITHUB_CLIENT_SECRET
GITHUB_APP_ID
GITHUB_APP_INSTALLATION_ID
GITHUB_APP_PRIVATE_KEY
SESSION_SECRET
AUTH_BASE_URL=https://one-click-ai-video-pilot.vercel.app
GITHUB_REPOSITORY=ktgmailorg/video-generator-rit
```

For a multiline GitHub private key, store the complete PEM value. The backend
also accepts newlines represented as `\n`.

Never place these values in Git, browser JavaScript, HTML, screenshots, normal
logs, or email.

Redeploy after setting the variables.

## 4. Acceptance check

Use an RIT Google account and a GitHub account that does not already have
repository access:

1. Open `/rit-access.html`.
2. Continue with RIT Google.
3. Confirm the page displays the verified RIT address.
4. Connect the intended GitHub account.
5. Confirm GitHub creates a read-only repository invitation.
6. Accept it and clone through GitHub Desktop.
7. Confirm the account cannot push to `main`.
8. Sign out and confirm the RIT session cookie is removed.

Also verify:

- A personal Gmail account is rejected.
- An expired or modified OAuth state is rejected.
- A user cannot type or substitute another GitHub username.
- No GitHub or Google OAuth access token appears in browser storage.
- Repository invitation failures do not grant access.

## Operational notes

- Sessions expire after eight hours.
- OAuth state expires after ten minutes.
- Sessions are HttpOnly, Secure, and SameSite=Lax.
- Google and GitHub tokens are not retained in the session.
- Logs contain a shortened hash of the RIT identity, the GitHub login, the
  repository, and the invitation result.
- Rotating `SESSION_SECRET` signs out all active users.
- Removing a collaborator in GitHub revokes access independently of the site.
