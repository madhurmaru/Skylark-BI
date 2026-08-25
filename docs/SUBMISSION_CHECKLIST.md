# Submission Checklist

## Live setup

- [ ] Import `Deal funnel Data(1).xlsx` as the **Deals** board.
- [ ] Import `Work_Order_Tracker Data(1).xlsx` as the **Work Orders** board.
- [ ] Apply the recommended column types in `MONDAY_SETUP.md`.
- [ ] Delete any row that repeats column headings.
- [ ] Record both numeric board IDs from their URLs.
- [ ] Create/copy a Monday personal API token from Developer Center.
- [ ] Push this source to a private GitHub repository.
- [ ] Import that repository into Vercel.
- [ ] Add `MONDAY_API_TOKEN`, both board IDs, and `HF_TOKEN` to Vercel.
- [ ] Redeploy and confirm the Integration Setup panel says **All systems ready**.

## Demo test

- [ ] Ask: “How is our energy sector pipeline looking this quarter?”
- [ ] Ask: “Where is our receivables risk concentrated?”
- [ ] Ask: “Which work orders are creating execution risk?”
- [ ] Ask: “Prepare a concise leadership update.”
- [ ] Confirm answers show source row counts and data-quality notes.
- [ ] Confirm no board record changes after testing.

## Submit

- [ ] Hosted Vercel URL
- [ ] `Skylark-Intelligence-Source.zip`
- [ ] `DECISION_LOG.pdf` (two pages)
- [ ] Optional: 60-90 second screen recording showing setup status and two queries

## Recommended demo narrative

“The model interprets the founder's question, but it never calculates the business totals. Live Monday rows pass through a deterministic normalization and metric layer, so the answer is repeatable, caveated, and traceable. If model inference fails, the core BI engine still returns a useful answer.”
