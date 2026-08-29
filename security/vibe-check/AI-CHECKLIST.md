# AI Security Audit Checklist — Tinguilin Admin

Audit actual source and corresponding API contracts. Cite `path:line`; frontend guards are not evidence of backend authorization.

## Coverage

- [ ] No secrets, privileged keys, database access, production tokens or personal-data fixtures in source, bundles, logs or Git.
- [ ] Login, token expiry, logout and interceptors fail closed; tokens do not appear in URLs or console output.
- [ ] Every dashboard read, mutation and export maps to an API route protected by JWT plus current admin role.
- [ ] High-impact actions require explicit UI confirmation and backend validation/audit logging.
- [ ] API/user content uses safe Angular binding; no sanitizer bypass, unsafe HTML, dynamic code or formula-unsafe exports.
- [ ] Pagination, search, filtering and export bounds prevent accidental or malicious bulk disclosure.
- [ ] Errors and analytics exclude stack traces, tokens, payment details, raw provider data and unnecessary personal data.
- [ ] External links/media require expected HTTPS hosts.
- [ ] Lockfile is synchronized and dependency advisories are reviewed.
- [ ] Tests cover ordinary-user denial, expired/revoked token handling, destructive confirmations and output escaping.

## Output contract

Create `security/reports/YYYY-MM-DD-security-audit.md` with severity, CWE, evidence, impact and remediation. Put work items in `security/plans/YYYY-MM-DD-remediation.md`; verify each fix with lint, tests and a production build.
