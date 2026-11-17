# U-GOV V6 — Bharat G-Bot and citizen experience

## Branch boundary

All work in this document is on `u_gov_v6`. It is not merged to `main`, and the existing V5 Render service has not been changed or deployed.

## G-Bot architecture delivered in this increment

- Provider selection supports an OpenAI-compatible chat API and Google Gemini. Configure `OPENAI_API_KEY` or `GEMINI_API_KEY`; OpenAI-compatible is selected first when both are present.
- Models are configurable with `OPENAI_MODEL` and `GEMINI_MODEL`.
- Public web research supports Tavily (`TAVILY_API_KEY`) with extracted page content, or Brave Search (`BRAVE_SEARCH_API_KEY`) for web result snippets.
- Internal U-GOV knowledge search indexes the public FAQ catalogue. Service discovery continues through the controlled service catalogue gateway.
- AI prompts receive bounded recent conversation context. Common Indian identity/contact patterns are redacted from content forwarded to hosted providers.
- Search citations distinguish internal U-GOV help content from Internet sources.
- Private application status and document readiness remain routed through the authenticated U-GOV tool gateway. Private lookups are not sent to hosted providers.
- Retrieved webpage text is treated as untrusted data and cannot override system rules.
- If no hosted provider is configured, the offline demo assistant now explains the limitation instead of presenting itself as a general-purpose model.

### Environment configuration

Set secrets only in the separate V6 preview service. Never commit real keys.

```env
OPENAI_API_KEY=
OPENAI_MODEL=gpt-4.1-mini
OPENAI_BASE_URL=https://api.openai.com/v1
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash
TAVILY_API_KEY=
BRAVE_SEARCH_API_KEY=
```

Tavily is preferred when configured because its search response can include extracted page content. Brave is used otherwise. Internet research remains unavailable until one search key and one hosted AI key are configured.

## Conversation history and privacy

- The current chat workspace stores up to 30 conversations in browser local storage, scoped by signed-in user ID on that browser.
- Users can create and delete conversations.
- This is device/browser-local persistence, not yet server-side or cross-device synchronization.
- Do not enter passwords, OTPs, Aadhaar/PAN numbers or other highly sensitive data into chat.
- Full server-side conversation storage, retention controls, export and cross-device synchronization require a separate privacy-reviewed PostgreSQL implementation.

## Visual system

Palette:
- Royal blue: `#174EA6`
- Trust red: `#D62828`
- Growth green: `#16834A`
- White: `#FFFFFF`
- Deep black: `#171717`
- Sunshine yellow: `#F5C518`

Typography:
- Plus Jakarta Sans for headings and display text.
- Inter for primary UI copy.
- Noto Sans Devanagari and Noto Sans Kannada for regional scripts.

Design principles: blue-led identity, white content surfaces, controlled red/green/yellow semantic accents, larger readable typography, clear focus states, responsive chat layout, and reduced visual density.

Red is reserved for destructive/urgent states, green for success, and yellow for attention/highlights. Do not use all accents at equal visual weight.

## Current scope limitations and next work

1. Web results currently use the search provider's returned snippets/extracted content; arbitrary URL fetching and a full crawler/index of every U-GOV page are not implemented.
2. Internal knowledge search currently covers the FAQ catalogue and service catalogue, not every route/component or all future documents.
3. Conversation history is local to one browser; server-side encrypted persistence is not implemented.
4. OpenAI/Gemini provider configuration is code-ready but requires secrets on a V6 preview environment.
5. The current runtime database remains the inherited JSON store. The V6 PostgreSQL migration foundation is not yet wired into runtime.
6. Complete page-by-page redesign of every module (DigiVault, consent, tracker, officer desk, grievance, admin, profile and mobile views) remains in progress.
7. Build, lint, regression tests and live preview verification must pass before this increment can be called release-ready.

## Verification status

GitHub Actions verification passed for commit `6a09030c95e48521a371fa6c90e0a1a4f120c12b`: `npm ci`, TypeScript type-check (`npm run lint`), production build (`npm run build`) and the full `npm test` suite all completed successfully. This verifies compilation and existing automated tests, but does not yet verify live OpenAI/Gemini/Tavily/Brave credentials, browser rendering, accessibility with assistive technology, mobile device behaviour or a V6 preview deployment. Those remain required before release.
