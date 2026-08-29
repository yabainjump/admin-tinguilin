# Manual Release Checklist — Admin

- [ ] Production bundle and source maps contain no secrets, tokens, personal-data fixtures or internal credentials.
- [ ] Admin host uses HTTPS, HSTS, restrictive CSP/frame policy and the expected API origin only.
- [ ] Ordinary users cannot access admin API data by navigating directly or replaying browser requests.
- [ ] Expired, revoked and downgraded admin sessions fail closed on the next request.
- [ ] Destructive actions show clear confirmation and produce server-side audit events.
- [ ] Exports escape spreadsheet formulas and contain only the minimum authorized fields.
- [ ] Browser console, analytics and error tracking contain no tokens, payment data or unnecessary personal data.
- [ ] Release dependency/advisory scan has no unaccepted critical/high findings.
