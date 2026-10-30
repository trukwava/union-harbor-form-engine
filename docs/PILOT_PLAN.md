# Client-discovery and shadow-pilot plan

No interviews, adoption, return on investment, regulatory approval, or market claims have been validated. All people, forms, and outputs in this package are synthetic.

## Five targeted discovery questions for an authorized domain owner
1. Which exact approved templates, edition dates, and approver references govern each recurring service-hours report? Who can authorize a wording or rule change?
2. Which fields are genuinely recurring versus week-specific, and which are subject to privacy or restricted processing?
3. How do staff currently detect incorrect times, unpaid breaks, duplicates, and overlapping entries? What happens when a report is returned for correction?
4. What is the actual review-and-delivery chain, and which states should be claimed, evidenced, or independently verified?
5. How many exceptions (week spanning holidays, overnight work, alternate departments, unusual text lengths) appear frequently enough to require P1 support?

## Baseline measurement (before the new tool)
For the existing process, have an observer time **start-to-review-ready** for 20 synthetic forms with a fixed task script and a mix of easy and edge cases. Record number of correction rounds, wrong or missing values, unresolved placeholders, rejected submissions, and operator questions. Do not collect real personal data in this demo.

## Shadow-mode trial
First, an authorized owner verifies the sample workflow against the actual approved document and supplies the approved wording outside this demo repository. Run both systems side by side without replacing the official process or sending generated forms. Test at least **20 distinct synthetic scenarios** covering: two departments, v1/v2 and explicit migration, conditional section on/off, week rollover, leap day, missing approver, optional blank vs zero, missing time, reversed times, break > duration, negative break, overlapping entries, adjacent non-overlapping entries, long name, long note, note with XML characters, stale edit, clone after an approved report, missing PDF tool, and multi-page output.

## Proposed success measures (not actual outcomes)
- **100%** of seeded arithmetic and overlap cases yield the expected pass/fail result.
- **0** unresolved required placeholders in export-ready Word or PDF artifacts.
- **0** clones preserve prior period dates, delivery assertions, or approvals.
- **0** published-template updates alter pre-existing export snapshots.
- At least **95%** of 20 synthetic tasks completed without help, subject to explicit acceptance by the owner.
- Relative preparation-time reduction is measured rather than assumed; no numerical benefit promised.

## Stop criteria
Stop and repair any unexpected document wording, incorrect paid/unpaid time calculation, invalid document marked ready, loss of template pin, hidden data leak, stale approval carry-forward, unreadable page break, unresolvable save conflict, or ambiguous role/approval semantics. Do not release with high-severity open issues.

## Next scope decision
If shadow-mode accuracy and operator feedback meet the domain owner's criteria, build an authenticated repository-backed application, approved-template ingestion with provenance, role-scoped reviewer workflow, real retention/deletion policies, and permission-aware audit guarantees. Otherwise revise the questionnaire, rules, and document renderer while maintaining the current process.
