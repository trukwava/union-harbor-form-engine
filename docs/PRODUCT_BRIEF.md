# Product brief — Union Harbor Form Engine
**Version:** 0.1.0 · **Date:** 2026-10-29 · **Status:** local synthetic demo

## Buyer, operator, and promise
Primary operator: small-association administrator preparing recurring weekly service-hour memoranda. A possible domain owner would be an authorized administrator with the power to verify applicable template wording and workflow; no real customer is represented.

**Promise:** From guided answers and safe reusable profiles to a validated, version-pinned, editable memorandum, with a human reviewer responsible for the final decision.

## P0 requirements implemented
- Department-specific sample templates, explicit effective dates, immutable version publication and selective conditional approved blocks.
- New form chooses the effective version for the service week and pins it; older forms retain previous versions even after publication of newer ones.
- Profile reuse, date-only service week, guided questions with help text, explicitly tagged answer states, repeated service-entry collection.
- Same-day deterministic interval/break arithmetic, required fields, date range, overlap, length, and bounded-choice validation.
- Persistent incomplete drafts, optimistic revision checks, live preview, blocked invalid exports, complete immutable render snapshots.
- Editable Word export; PDF via LibreOffice where installed, plus browser print-to-PDF fallback.
- Copy-forward with resetting all period-specific fields and statuses; version migration requires an explicit request followed by revalidation.
- Export lineage (form revision + template version + SHA-256), manual delivery and review assertions recorded separately; audit metadata log.
- Resettable synthetic fixtures: two variants, v1/v2 per variant, three profiles, six valid forms, three invalid/incomplete drafts. Long names, long notes, leap week, overlap.

## UX decision
Operational workspace, not a landing page: left navigation for preparation, exports, template studio, and metadata history; document preview alongside the questionnaire. Neutral visual hierarchy with focus states and a sample-only label. No vanity metrics, AI chat, fabricated testimonials, or integrations.

## Parking lot (explicitly not in demo)
Official contract interpretation, unrestricted arbitrary-code form-building, customer account systems, real upload/import pipelines, document signature collection, outbound transmission, production auth/tenant isolation, case assignment, complex calendaring, payment, AI-generated official text, bulk migration, external archive connectors, mobile-native app, real approval verification.

## Primary risk
Correctness is a joint property of form answers, arithmetic, template branch selection, versioning, and the generated document. Therefore: one deterministic typed domain core; snapshots freeze a reviewed version and revision; no arbitrary template scripting or model-generated language; exports blocked by validation failures. Browser preview is informative; server validation is authoritative.
