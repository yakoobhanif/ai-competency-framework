# Natural-work tasks and submission contract

Implementation revision: natural-work-1.1 / pilot-3.0-noul-boost.

This revision supersedes the prescribed prompting steps and omission-based scoring in the earlier platform vision. The capability definitions and objective quiz remain unchanged.

## Student experience

The learning task is preparation for an introductory cognitive science quiz. Its topic list follows the supplied twelve-slide memory-and-attention deck. Students study naturally, with or without AI. There is no extra content quiz, prescribed prompt sequence, closing response or learning deliverable. The essay and coding routes retain their published deliverables and requirements but also allow natural work with or without AI.

Each task offers two exclusive expandable submission choices. AI users import a public whole-conversation ChatGPT, Gemini or Claude link or upload an existing transcript/export. No-AI users save a brief account of their approach. Changing modes replaces the active task submission after confirmation. Unsaved account edits block continuation. Creation still requires its deliverable regardless of AI use.

## Capture before evaluation

1. `server/shared-chat.ts` validates HTTPS provider URLs and every redirect, pins DNS resolution to checked public IPv4 addresses, limits response size/time, and reports provider access failures. Node's automatic dual-stack lookup is disabled for the pinned IPv4 callback. No user cookies, credentials or access-control bypass are used.
2. `server/conversation.ts` reads JSON string literals from React Router stream chunks. `server/stream-decoder.mjs` decodes the v2 wire format in a disposable worker with a five-second deadline, bounded heap and reference-table size, and a restrictive type/key allowlist. Scripts are never executed. Selected tree branches or provider linear order supply explicit author roles. System/developer messages, provider-hidden context and internal reasoning metadata are excluded, not presented as student evidence. Unsupported or ambiguous structures are not guessed.
3. Gemini shares are read from the public data request the share page itself makes (`server/gemini-chat.ts`); the format is undocumented, and unexpected shapes stop the import. Claude's equivalent request is currently blocked by Cloudflare, and no attempt is made to bypass that, so students are told to save the page from their browser and upload it. Saved Claude pages are read using their speaker markers.
4. `server/evidence.ts` reads native single-conversation JSON exports, saved HTML, or existing headings in TXT/Markdown/text-PDF files. Code-fenced speaker-like text is not a new turn. Account-wide JSON archives are rejected. Unattributable text is retained for review. Uploading an account export is neither needed nor encouraged.
5. Originals are retained privately with SHA-256 hashes. Link imports additionally retain the fetched response, source hash, URL, timestamp and parser version. Normalized `T001...` turns distinguish student, assistant and tool. Media/attachment content that is unavailable is explicitly marked in the transcript, which still proceeds to scoring. Neither the student nor a classifier is asked to guess speakers.
6. Students inspect the preview and confirm completeness. Confirmation does not establish factual truth, authorship authenticity or completeness beyond the snapshot; uploaded files and shared conversations are not tamper-proof research logs.

## Jev boundary

`gradeTranscript` first excludes no-AI accounts and capture failures. No-AI accounts produce absent observations; uncertain attribution produces pending observations, without a Jev call. Missing media does not stop the Jev call. Demo mode respects these exclusions too.

Each eligible transcript is evaluated in one Jev 1.14 NOUL call against all 24 transcript capabilities, including U1, using the approved names and descriptions. C5 is excluded from both transcript calls and learning entirely. Jev sees full attributed conversations, with assistant replies as context. Learning receives a short task summary and concepts, without slide text. Creation receives the assignment, the final artifact and its previously established pass/fail result; coding also supplies the complete problem. Self-ratings, quiz responses and the other task's results are excluded.

Learning assessment starts immediately after submission. Essay grading first evaluates five rubric criteria through NOUL; pass requires at least three probabilities >=0.70 and all five >=0.50. Source-check results and word count are context, without additional pass gates. Coding passes all deterministic hidden tests or fails; infrastructure errors remain pending. C5 receives creation evidence 1 for Pass, 0 for Fail, or unavailable for technical Pending.

Practical evidence below 0.70 adds nothing. Otherwise the task contributes `0.5 × (100 − Q) × probability` to the capability's original quiz score Q. The combined profile uses the maximum task contribution per capability and then averages the full dimension. Practical work cannot lower Q. No-AI accounts and ambiguous capture add no transcript credit; missing evidence does not establish inability.

Stage caches retain input hashes, prompt versions, returned model identifiers and raw probabilities. Unchanged successful stages are reused; failed stages retry. Claude sees only definitions and the numeric results visible in the requested view, never transcripts or artifacts. Its paragraph feedback cannot change scores. See [current scoring contract](scoring-contract.md).

Natural-work observation gives less guaranteed capability coverage than prescribed tasks. A missing transcript demonstration cannot establish inability, and conversation evidence cannot establish unaided retention. A follow-up assessment would be needed to fill genuine coverage gaps.

## Verification and limitations

The original supplied `/s/cx_...` link returned HTTP 403 after the network fix. A public `/share/...` example was successfully decoded into six visible text turns; unavailable image content was marked as unavailable. A real public Gemini link imported correctly, but it had only one exchange, so multi-turn Gemini ordering is tested with synthetic data. Real Claude snapshot requests returned a Cloudflare challenge (HTTP 403), so the snapshot parser is tested with synthetic data only, and saved-page parsing uses markers confirmed on a real shared page. None of this guarantees that provider formats will stay compatible.

Tests cover streamed/deferred data, selected branches, native JSON/HTML uploads, blocked/one-sided pages, missing roles, no-AI scoring, preview confirmation, both practical routes, responsive PDF rendering, and provider request contracts. Synthetic live checks exercise both providers; educational judgement still requires human-labelled validation.

Dependency note: `turbo-stream` 2.4.1 is pinned for the format observed on the live page; v3 uses a different wire format. npm flags [GHSA-rxv8-25v2-qmq8](https://github.com/advisories/GHSA-rxv8-25v2-qmq8), a serialization denial-of-service advisory. Production uses only bounded, worker-isolated decoding, never this package's encoder; encoding is used only for synthetic tests. The package advisory remains and must be considered before deployment. Existing Mammoth/argparse/sprintf dependency advisories also remain outside this task's scope. Do not treat the current local prototype as deployment-hardened.

## References

- [OpenAI sharing documentation](https://help.openai.com/en/articles/7925741-sharing-conversations-and-scheduled-tasks-in-chatgpt): whole-conversation versus individual-response sharing and visibility restrictions.
- [Turbo Stream](https://github.com/jacob-ebey/turbo-stream): maintained decoder used instead of executing page scripts.
- [ChatGPT share reader implementation notes](https://github.com/chickensintrees/chatgpt-share-reader): undocumented React Router hydration format; validated independently against a live public page.
- [Jev NOUL](https://docs.typesafe.ai/primitives/noul): the probability of a yes/no decision. Parsing and attribution happen before these calls.
