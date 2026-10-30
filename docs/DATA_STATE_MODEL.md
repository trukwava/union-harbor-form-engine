# Data, rules, and state model

## Named domain objects
- **Organization** `id/name/mode` (fictional, one organization).
- **Template** `id/organizationId/department/name/description` identifies a variant.
- **TemplateVersion** `id/templateId/version/effectiveFrom/effectiveTo/createdAt/title/variables/blocks/branches/outputFields/validationRules/status` is append-only once published.
- **VariableDefinition** `key/label/type/required/help/choices/maxLength` provides the guided question contract.
- **BranchRule** `blockId/field/op/value` supports only `eq`, `neq`, `in`, and `exists`, with no `eval`/JavaScript.
- **ApprovedTextBlock** `id/label/text/order` contains the version's administratively supplied prose.
- **UserProfile** `id/organizationId/fullName/role/department` is reusable and contains only synthetic non-sensitive fields.
- **FormInstance** `id/organizationId/templateId/templateVersionId/profileId/department/weekStart/answers/entries/revision/createdAt/updatedAt/cloneOf` is mutable as a draft, with an append-only revision history.
- **AnswerRevision** `number/at/fields` logs *which fields* changed; no raw sensitive values in the audit stream. Current answers are retained in the form.
- **TimeEntry** `id/serviceDate/activity/start/end/breakMinutes/notes` preserves source values and calculates net minutes per entry.
- **ValidationResult** transient `{ready,errors,totalMinutes,totalHours,entryMinutes}` computed on demand from pinned template + current profile + form.
- **RenderArtifact** `id/formId/templateVersionId/revision/checksum/filename/snapshot/createdAt` is an immutable exported-content snapshot, optionally annotated with manual delivery and review assertions.
- **Review** user-reported `delivered_by_user` or `approved_by_reviewer` plus timestamp/reference. No independent verification, signature, or external action.
- **AuditEvent** metadata-only change record with action, entity, timestamp, and non-sensitive description.

## State transitions

1. **Draft saved**: valid or invalid; revision incremented. Saved ≠ ready.
2. **Ready**: computed from zero validation errors; not a stored certification or approval.
3. **Exported snapshot**: available only if ready. Snapshot content is frozen to its source revision and template version; it may be downloaded repeatedly in DOCX or PDF.
4. **Delivered by user (reported)**: explicit operator declaration attached to that snapshot, not a send action.
5. **Approved by reviewer (reported)**: explicit operator declaration, requires a delivered report and reviewer reference. It is not an electronic signature or verified reviewer action.

A later form edit or template publication does not alter an existing snapshot. New exports require validation against the form's pinned version. Explicit version migration updates only that form's future content, increments its revision, and reruns validation. Existing artifacts remain frozen.

## Deterministic constraints
- Time is `HH:mm` 24-hour local wall-clock within a single date, with no overnight shift support. Each net duration equals `end - start - unpaid break` measured in **integer minutes**. Sum minute values before converting to decimal hours.
- Date-only `YYYY-MM-DD` stays distinct from an exact `...Z` timestamp. Week start must be Monday; service dates must fall within that seven-day range, including leap-day handling. Display timestamps use ISO UTC; the UI does not imply a configured production timezone.
- Negative / non-integral / longer-than-interval break is invalid. A **blank** break is invalid; `0` is a meaningful value. Equal or reversed start/end is invalid. Multiple entries on the same date must not have overlapping intervals.
- Answers explicitly distinguish `blank`, `unknown`, `na`, and `value`. Required fields accept only a nonempty supplied `value`. Optional blanks export as `Not supplied`, and optional unknowns as `Unknown (declared)` rather than unresolved placeholders.
- New form uses the highest published version effective for that week. Already created forms retain `templateVersionId` until an explicit migration request.
- Published template definitions are bounded (`<=40` variables/blocks, `<=80` rules, `<=300` max service entries) and never run untrusted JavaScript.
- All user text is XML escaped in DOCX, HTML escaped in the UI, limited in length, and processed exclusively as data. An imported paragraph cannot govern application behavior.
- All updates are constrained to the synthetic organization and serialized through an atomic file replacement; optimistic `baseRevision` rejects stale writes. No production multi-user access control is claimed.

## Gaps requiring production design
The filesystem persistence layer is not a multiwriter ACID database; there are no authenticated identities, true per-organization role enforcement, external template import and provenance signatures, verified review approvals, retention policies beyond manual reset/delete, regulated-data handling, or independent audit integrity verification. Do not switch `HOST` to `0.0.0.0` for an untrusted network.
