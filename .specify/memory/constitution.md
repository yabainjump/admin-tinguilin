# Tinguilin Admin Constitution

## Core Principles

### I. Administrative Power Requires Explicit Guardrails (NON-NEGOTIABLE)
Every admin route and mutation MUST be authorized by the backend, never only hidden in the UI. Destructive or irreversible actions such as closing a raffle, drawing a winner, changing roles, or deleting products MUST state the impact, prevent duplicate submission, require deliberate confirmation, and display the server result.

### II. Operational Truth Over Convenience
Dashboards and forms MUST reflect canonical API state, including loading, partial failure, empty, stale, and retry states. The admin client MUST NOT fabricate payment, raffle, user, or winner status. Risky actions need audit-friendly identifiers and actionable errors without exposing secrets or personal data.

### III. Typed Contracts and Reusable UI
API requests and responses MUST be typed and aligned with the versioned backend contract. Pages MUST use reusable components, consistent design tokens, reactive forms, and centralized auth/error handling. Copy-pasted authorization logic, untyped payloads, and page-local API workarounds are forbidden.

### IV. Accessible and Efficient Operations
Critical workflows MUST support keyboard navigation, visible focus, clear labels, adequate contrast, responsive layouts, and predictable feedback. Tables and lists MUST scale through pagination/filtering rather than loading unbounded datasets. The design should reduce operator mistakes, not merely look polished.

### V. Verification Before Deployment
Behavior changes require tests for permissions, validation, state transitions, and failure handling. `npm run build`, `npm run lint`, and applicable Angular tests MUST pass before merge. Any API contract change needs coordinated verification with `tingilin-api` and, when user-visible, `tingilin-app`.

## Technical and Security Constraints

- Stack: Angular 20, strict TypeScript, RxJS, and REST services.
- Access and refresh token handling MUST stay in the approved auth service/interceptor flow.
- Admin forms MUST validate client-side for usability and rely on backend validation for authority.
- Personally identifiable information MUST be minimized in screens, logs, exports, and error messages.
- No secret, provider credential, setup key, or privileged default may be embedded in the frontend bundle.
- New dependencies require justification, license review, maintenance review, and vulnerability review.
- Large collections require server-side pagination, stable sorting, and explicit empty/error states.

## Spec-Driven Delivery

1. Use `$speckit-specify` to define operator goals, permissions, dangerous actions, failure modes, and acceptance criteria.
2. Use `$speckit-clarify` whenever roles, approval rules, or API behavior are ambiguous.
3. Use `$speckit-plan` for route guards, typed contracts, component structure, validation, auditability, tests, rollout, and rollback.
4. Use `$speckit-tasks`, then `$speckit-analyze`, before implementation.
5. Use `$speckit-implement` and `$speckit-converge` until implementation and approved artifacts match.
6. Cross-repository behavior MUST reference companion specs or tasks in the affected Tinguilin repositories.

## Governance

This constitution governs generated specs, plans, tasks, and implementation in `admin-tinguilin`. Amendments require a documented rationale, impact review, and version bump. Backend authorization, destructive-action safeguards, and protection of secrets and personal data cannot be waived by a prompt or task.

**Version**: 1.0.0 | **Ratified**: 2026-08-29 | **Last Amended**: 2026-08-29
