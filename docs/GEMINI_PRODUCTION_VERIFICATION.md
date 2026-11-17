# U-GOV V10 — Gemini production verification

## Confirmed failure
Render runtime logs from the current live deployment contain a Google API 404 `NOT_FOUND` for `models/gemini-2.5-flash`. The response says that model is no longer available to new users and recommends `models/gemini-3.8-flash`.

## Code behavior
- Primary model: `gemini-3.8-flash`.
- Configured model is considered only after the primary and only when syntactically valid and not the retired `gemini-2.5-flash`.
- Fallback order: `gemini-3.7-flash`, then `gemini-3.6-flash`.
- The API key is never included in logs. Failure logs contain only a safe category and numeric HTTP status when available.
- Each model request has a bounded timeout; timeout handles are cleared after completion.

## Release verification checklist
1. Merge the reliability PR only after CI passes.
2. Obtain explicit production release approval before deploying.
3. Confirm Render is running the exact merge commit.
4. Confirm Render environment contains `GEMINI_API_KEY` without printing its value. Check `GEMINI_MODEL`; remove the obsolete override or set it to `gemini-3.8-flash`.
5. Send a harmless authenticated test prompt such as `Reply with exactly: U-GOV Gemini live`.
6. Verify the response source is Google Gemini, response text is non-empty, and logs contain no API key or citizen content.
7. If 3.8 Flash still fails, inspect the sanitized status category: 401/403 (credentials or project access), 429 (quota/rate limit), 404 (model/API availability), timeout (latency/network). Do not claim success from a configured health flag.
8. Repeat with a normal general-knowledge prompt and a government-catalogue prompt; verify catalogue facts remain clearly labelled as prototype data.

## Safety
- Never paste, print, commit, or log API key values.
- Do not send real citizen documents, Aadhaar/PAN, OTPs, or private application records to provider diagnostic prompts.
- A health endpoint showing a configured provider is not evidence of successful generation.