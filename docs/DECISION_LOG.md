# Decision Log - Skylark Intelligence

## Product interpretation

I interpreted the task as an executive decision-support layer rather than a general chatbot. A useful answer must state the result, explain why it matters, reveal the underlying scope, and disclose data limitations. The optional “leadership updates” requirement therefore became a first-class query intent that returns four components: headline KPIs, notable movement or concentration, risks/caveats, and recommended follow-up actions. It uses the same live board pipeline as ordinary questions; it is not a separate static report.

## Key assumptions

1. Monetary values are INR. Work-order headings explicitly say rupees; masked deal values are assumed to share the business reporting currency.
2. “Energy” means Powerline + Renewables. This is disclosed in the response scope.
3. Active pipeline means Open + On Hold. Won/Lost deals are excluded from forward pipeline.
4. Weighted probability uses High 75%, Medium 50%, Low 25%. A missing probability uses a conservative 30% only for weighted metrics and is always flagged.
5. “This quarter” is based on the server’s current date, not the latest date found in the dataset. Empty periods produce an honest zero-result explanation.
6. The masked exports do not provide a reliable universal key between every deal and work order. Cross-board analysis is therefore aggregate-based (sector, owner, dates), not a fabricated record-level join.
7. Monday column titles retain recognizable business meaning after import. Matching is tolerant of capitalization, punctuation, and close aliases.

## Architecture and key decisions

I chose Next.js/TypeScript on Vercel for a single deployable UI/API artifact, fast iteration, server-only secret handling, and straightforward evaluation. Monday’s GraphQL API was selected over MCP because the hosted prototype needs deterministic authentication and pagination without depending on an evaluator’s MCP client. Access is read-only by implementation: only board/item queries exist.

The agent uses a hybrid architecture. Hugging Face’s OpenAI-compatible inference endpoint interprets the question into a typed plan and explains computed facts. A deterministic engine performs filtering, joins-at-aggregate-level, and every financial/operational calculation. This avoids asking an LLM to add hundreds of rows, reduces hallucination risk, lowers token cost, and makes tests meaningful. If inference fails, a heuristic planner and deterministic narrative preserve core availability.

Data is fetched dynamically for every question. The normalizer discovers columns from titles, standardizes dates/statuses/sectors, parses formatted numbers, retains suspicious values rather than silently correcting them, and attaches row-level quality flags. Responses surface top caveats and board row counts.

## Trade-offs

- **Freshness vs latency:** Fetching both boards per question guarantees current answers but adds API latency. For these small boards that is preferable to a stale cache.
- **Transparency vs optimistic cleaning:** Negative billing and blanks are retained and flagged; silently imputing or deleting them would produce cleaner-looking but less defensible KPIs.
- **Personal token vs OAuth:** A personal token is fastest for a six-hour private prototype. It inherits the user’s permissions, so OAuth with explicit scopes is the production path.
- **Model quality vs cost:** `gpt-oss-120b:cheapest` offers capable tool-style reasoning through Hugging Face routing. Deterministic computation limits dependence on the model and protects the demo if free credits run out.
- **Flexible schema vs strict mapping:** Semantic title matching tolerates messy imports. A production connector should add an admin mapping screen and persist verified column IDs.

## With more time

I would add OAuth, per-user authorization, encrypted connection management, a schema-mapping wizard, Redis caching with Monday webhooks, traceable drill-down links to source items, time-series snapshots, saved questions, exportable leadership briefs, feedback/evaluation datasets, and observability for latency, token cost, API complexity, and answer faithfulness. I would also validate metric definitions with Finance/Sales leadership and add record-level joins once a stable deal ID exists across both boards.

## Evaluation focus

The prototype should be judged on live-data grounding, resilience to missing fields, honest caveats, exact repeatability of metrics, conversational usefulness, and whether an executive can move from question to decision without asking an analyst to prepare a new spreadsheet.
