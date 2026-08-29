# Tinguilin Admin Security Rules

These rules adapt benavlabs/vibe-check to the Tinguilin Angular administration console. They apply to every generated or reviewed change.

## Non-negotiable controls

- The admin bundle is public. Never embed secrets, provider credentials, database access, privileged keys, production tokens, or confidential configuration in source or environments.
- Every admin read and mutation must be authorized by the backend with a valid JWT and current server-side admin role. Angular route guards and hidden buttons are UX controls only.
- Use the shared authentication service/interceptor and approved token storage flow. Do not add raw token logging, URL tokens, or ad-hoc storage.
- Treat all API data and form input as untrusted. Use Angular bindings; forbid unsafe `innerHTML`, sanitizer bypasses, dynamic code, and spreadsheet/formula injection in exports.
- Require explicit confirmation for destructive or high-impact actions. The backend must enforce validation, authorization, idempotency where relevant, and audit logging.
- Do not expose personal data, payment details, tokens, stack traces, or raw provider responses in console logs, errors, analytics, or exported files.
- External links and media URLs require HTTPS and trusted-host validation.
- Commit and use `package-lock.json`; review advisories before upgrades and avoid abandoned dependencies.

## Required verification

For security-sensitive changes, run `security/vibe-check/AI-CHECKLIST.md`, add regression tests, then run `npm run lint`, `npm test -- --watch=false`, and `npm run build`. Record unresolved risks under `security/plans/`.
