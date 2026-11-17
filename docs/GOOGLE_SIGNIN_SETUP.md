# U-GOV Google Sign-In setup

This implementation uses Google's official Google Identity Services (GIS) JavaScript button with a server-verified OpenID Connect ID token. U-GOV continues to issue its own HttpOnly session cookie after verification.

## 1. Create a Google OAuth web client

1. Open the Google Cloud Console: https://console.cloud.google.com/
2. Select or create a project for U-GOV.
3. Configure the OAuth consent screen / Google Auth Platform branding and audience.
4. Request only the basic identity scopes: `openid`, `email`, and `profile`.
5. While the app is in Testing mode, add the Google accounts that need to test sign-in as test users.
6. Create an OAuth Client ID with application type **Web application**.
7. Add these Authorized JavaScript origins:
   - Production: `https://ugov.onrender.com`
   - Local development: `http://localhost:3000`
8. This implementation uses the GIS JavaScript popup callback flow; it does not require an OAuth redirect URI.

The OAuth Client ID is public browser configuration. Do not commit it as a secret and do not create or expose a client secret for this flow.

## 2. Configure Render

After the V8 branch is approved and deployed to the intended service, add this environment variable in Render:

- `GOOGLE_CLIENT_ID`: the Web application OAuth Client ID from Google Cloud Console.

Do not set a client secret. The backend exposes the client ID through `GET /api/v1/auth/google/config` so the browser can initialize GIS.

For a preview deployment, add the same variable only to the dedicated preview service. Do not change production settings just to test the branch.

## 3. Test

1. Open the sign-in page on the configured origin.
2. Confirm the official Google button appears.
3. Sign in with a Google test account.
4. Confirm a new account receives only the `CITIZEN` role.
5. Sign out and sign in again with the same Google account.
6. Confirm the same U-GOV account is used.
7. Test an email that already exists as a password account; Google sign-in must not silently link it.
8. Confirm logout revokes the U-GOV session.

## 4. Account and storage limitations

- Existing email/password accounts are not silently linked to Google. The user must authenticate to the existing account before an explicit linking flow is added.
- The current U-GOV metadata store is JSON-file based. On the current Render ephemeral-demo configuration, Google-created accounts may be lost after restart or redeploy. Do not use real citizen data. Durable production use requires a persistent database and a reviewed migration.
- A successful GitHub build/test run does not replace a real OAuth test against the configured Google project.
