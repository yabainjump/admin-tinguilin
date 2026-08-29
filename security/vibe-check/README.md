# Vibe-check for Tinguilin Admin

This directory adapts [benavlabs/vibe-check](https://github.com/benavlabs/vibe-check) at commit `8894f172c24224a7aaf87e723fc0b88c319f8963` to the Angular administration console.

Use `../../AGENTS.md` during implementation, `AI-CHECKLIST.md` during code review, and `manual-checklist.md` on a release build. Reports and remediation plans belong in `../reports/` and `../plans/`.

Client guards never establish admin authorization. Audit the corresponding NestJS controller, guard, service, and audit-log path for every admin operation.

The upstream project is MIT licensed; see `UPSTREAM-LICENSE`.
