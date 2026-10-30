# Operator guide

## Starting and recovering
Run `npm start`, then open `http://127.0.0.1:4173`. The `data/demo.json` file persists records across restarts. For a clean seed, use the History screen's **Reset demo data** action or run `npm run reset`. Both intentionally erase *only the dedicated synthetic demo file*. Copy it to a different location first if you want a backup.

## Prepare, validate, export
Pick a prior draft or create a new one. The week picker must name a Monday. The department variant and effective version are selected at creation. Required question explanations appear under each field. Enter times in 24-hour format. An unpaid break of zero means *no unpaid break*, not a missing answer. A blank break is invalid. Unfixed overlap and negative interval errors block readiness and export. After saving, click **Create export snapshot** and download the DOCX/PDF from Export history. A download recreates output from the immutable content snapshot, never from the latest draft.

DOCX is editable. Local LibreOffice is needed for automatic PDF; if unavailable, use the preview's browser **Print / Save PDF** action and verify the result manually. The preview can display incomplete draft placeholders; an export may not contain unresolved required placeholders.

## Follow-up, cloning, and migration
Mark **delivered** only after you have independently delivered the file. Mark **approved** only after you have independently received review. Both fields are unverified user reports; never use these records as proof of approval.

To repeat a week, use **Clone to next week**. It keeps the name/role profile and template pin, but resets all times, service dates, preparer period notes, approver reference, and all downstream reported statuses. If a newer template must apply, choose **Explicitly migrate** and review the resulting validation issues; previously exported snapshots do not change.

## Template publisher
Open Template studio, choose a template or start a new one, then edit the readable JSON definition. The editor exposes title, effective dates, question definitions with explanations, approved text blocks, rules, output fields, and validation limits. Only four exact operators are accepted. The **sample preview** renders the selected branch for demonstration values, but publication requires an authorized human to verify the content. Publish a fresh version; no in-place change is made to older versions.

## Distinct error states
- **Needs review**: draft saved but validation failed.
- **Ready to export**: deterministic constraints pass, not approved.
- **Unsaved / Saving / Save failed**: editor persistence feedback.
- **Stale edit**: HTTP 409; reload the form before deciding which revision to retain.
- **PDF conversion unavailable**: use LibreOffice or print-to-PDF; Word is still available.
- **Missing template effective for week**: choose a week that has a published version or ask an authorized admin to publish one.
- **Local app unavailable**: `/health` reports demo server status; restart `npm start` and inspect console.

## Safety
Never enter actual participant records, contractual wording without authorization, or production secrets. All official approval, delivery, and signature handling remains out of scope.
