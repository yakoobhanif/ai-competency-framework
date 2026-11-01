# Current scoring contract

Version: `pilot-3.0-noul-boost`. Jev: `jev-1.14.0`. Commentary: `claude-sonnet-5-5`.

## Numerical rules

Questionnaires are unchanged. Self-assessment stores 1–5 or Not sure, separately from performance. The quiz stores one binary 0/1 answer per capability; Not sure is zero, a missing response is unknown. Answers remain keyed by question ID regardless of shuffled presentation order.

Each transcript is evaluated in one call containing 24 NOUL questions, one per capability excluding C5. NOUL is the probability that the student's contribution demonstrates the capability, not a proficiency scale. No separate confidence, turn-selection classifier, or 0–3 rubric remains. Low probabilities do not prove low ability.

For capability c, define Q as its quiz percentage and E as its task probability when >=0.70, otherwise 0. The task boost is `0.5 × (100 − Q) × E`. Learning and creation views each add their own boost to Q. The combined view adds `max(learning boost, creation boost)` per capability before dimension aggregation. Different capabilities therefore contribute together; overlapping evidence is never counted twice. Missing Q remains unknown. Dimensions use their full capability counts (9/4/6/6); legacy incomplete quiz domains need at least 80% coverage before display, with missing contributions excluded from the numerator.

C5 has no learning contribution. Creation E is exactly 1 for an artifact Pass and 0 for Fail. A technical Pending leaves it unavailable. C5 uses the same boost formula; failure cannot reduce a correct quiz result.

Essay grading uses five NOUL criterion probabilities. Pass requires at least three >=0.70 and all five >=0.50, inclusively. Valid decisions are always Pass/Fail; source checks and word count inform the criterion decisions without extra gates. Each linked source reaches Jev as `retrieved`, `partial` (the first 60,000 characters), `metadata_only` (Crossref title and any abstract for a DOI whose page is unavailable; Crossref receives only the DOI) or `not_retrieved` with a neutral reason. A source the portal could not retrieve is not evidence against the essay, and Jev judges it from its citation. The complete essay includes the bibliography; word count excludes it. Coding uses the isolated deterministic runner unchanged: all 100 hidden cases must pass, with the published eight-second/96 MB configuration. Infrastructure failure is Pending, not Fail.

## Calls and persistence

1. Learning submission starts its transcript call in the background. State includes a brief purpose, topic concepts, all 25 definitions and the full attributed conversation. No slides/reference text are sent.
2. Creation first evaluates the artifact: five NOUL decisions for an essay, or deterministic tests for code.
3. Creation then evaluates its transcript, with the assignment, all definitions, final artifact and the artifact verdict. Coding includes the full problem. It receives no learning results, self-ratings or quiz data.
4. The server calculates profiles deterministically. Claude never supplies numbers for scoring.
5. Five independent Claude requests receive only visible definitions, per-capability quiz points, permitted self-ratings and permitted practical probabilities/contributions. Hidden task data and raw submissions are omitted. Paragraph counts are 2/1/2/2/2, with schema and count validation in the application. Invalid output or transient errors get one bounded retry, then a template fallback.

Prompts and version constants live in `server/prompts.ts`. `server/providers.ts` builds the actual NOUL input/output contracts. `server/summaries.ts` builds filtered commentary payloads. Do not add raw transcripts to commentary requests.

Each successful stage stores a fingerprint of its input, model, prompt and scoring version, with returned probabilities and the actual model identifier. Reloads and retries reuse unchanged successful stages. Failed/unreadable stages remain pending and are retried, preserving the quiz baseline. Changed submissions invalidate the affected cache. Existing reports are archived on re-evaluation; older saved prose remains renderable. Removing obsolete assessor-only metadata migrates only the exact compatible questionnaire hash, preserving answers and question order.

Demo mode uses labelled illustrative practical probabilities and never calls AI providers. Its code tests remain real. No-AI accounts are not treated as transcripts. Reviewer probability adjustments use 0–1 and retain an audit trail; C5 uses an artifact verdict.

## Validation

Unit tests cover all quiz options, threshold boundaries, C5, headroom, per-capability max, full dimension denominators, provider contracts, strict visibility filtering, stage order, caching and retries. Browser tests cover both pathways, reviewer audit, resume, responsive results and accessibility. `scripts/live-smoke.ts` runs a synthetic HTTP assessment against an isolated live server; set `SMOKE_PATHWAY=essay` for the essay route. It verifies both pinned model IDs, 48 NOUL observations, exact paragraph counts and boost-only invariants. Synthetic checks establish integration, not educational validity.

References: [NOUL](https://docs.typesafe.ai/primitives/noul), [Jev models](https://docs.typesafe.ai/models), [Claude structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs).
