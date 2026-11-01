# AI Competency portal

This is the web app students use to take the assessment. It walks them through the self-assessment, the quiz and the two practical tasks, scores their work and shows them their results. There's also a separate screen where a researcher can review and correct scores.

It's a research prototype that runs on your own computer. It only accepts connections from localhost, so please don't put it on the public internet as it stands.

## Getting started

You need Node 22.13 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:4173. If that port is taken, the terminal tells you which one it picked instead.

To run the production build:

```sh
npm run build
npm start
```

Only run one server at a time against the same data folder.

## Demo and live mode

Without any configuration, the portal runs in **demo mode**, which needs no keys and sends nothing to any AI provider. The quiz and the coding tests are scored for real, but the practical scores and written feedback are placeholders, and the results page says so.

**Live mode** does the real grading. Copy `.env.example` to `.env`, set `ASSESSMENT_MODE=live`, and add a `TYPESAFE_API_KEY` for Jev and an `ANTHROPIC_API_KEY` for Claude. Restart the server afterwards. An attempt keeps the mode it started in.

To check that live grading works end to end, start the server in live mode and run `npm run test:live`. It uses made-up data, but it makes real, paid model calls.

## How scoring works

Each capability starts from the student's quiz answer, which gives it 100 or 0. Practical work can only add to that:

- Jev reads each conversation and gives the probability that the student demonstrated each capability.
- Anything below 0.70 adds nothing. Above that, the capability moves up by `0.5 × (100 − quiz score) × probability`.
- When both tasks show the same capability, only the stronger one counts.

Essays pass with at least three of the five criteria at 0.70 or above and all five at 0.50 or above. Code passes only if it gets all 100 hidden tests right. Claude writes the feedback paragraphs, but it only sees the numbers and can't change them. Students see a category for each of the four areas, never raw scores.

These thresholds are pilot choices and still need checking against human ratings. The exact rules are in [docs/scoring-contract.md](docs/scoring-contract.md), and what counts as a valid submission is in [docs/task-submission-contract.md](docs/task-submission-contract.md).

## How students submit conversations

Students can paste a share link or upload a file (TXT, Markdown, PDF, DOCX, saved HTML or a single-conversation JSON export). If they worked without AI, they write a short note about how they worked instead. Whichever they choose, they check a preview before continuing.

Share links are best effort, because none of these providers offers an official way to read them:

| Provider | What happens |
| --- | --- |
| ChatGPT | Imports directly from `chatgpt.com` or `chat.openai.com` links. |
| Gemini | Imports directly, including `g.co` short links. |
| Claude | Claude's bot protection currently blocks the import, and we don't try to get around it. The student gets instructions to open the link in their browser, save the page as "Webpage, Complete" and upload that file. The direct import will start working if Claude ever allows it. |

Conversations containing images or attachments that we can't read are still scored. Each unreadable item is marked in the transcript, and Jev assesses the rest of the conversation.

## Coding tests

Submitted Python runs inside a locked-down Docker container with no network access, so Docker Desktop needs to be running. Download the image once:

```sh
docker pull python:3.12-alpine
```

If Docker isn't available, the result stays pending rather than failing the student.

## Reviewing scores

Go to http://localhost:4173/review. The access token is in `.data/reviewer-token`, or you can set your own with `ADMIN_TOKEN` in `.env`. You can read each student's work and correct a score, and every correction needs a reason and is kept in an audit trail.

## Where data goes

Attempts and uploads live in `.data/`, which isn't encrypted, so use an encrypted computer. Finished assessments are also copied to `../student-runs/`, as described in [its README](../student-runs/README.md). Those copies stay until you delete them, even when a student deletes their attempt. Before a real study, review consent and how long providers keep data.

## Finding your way around the code

| Where | What it does |
| --- | --- |
| `client/src/` | The React interface. `App.tsx` is the student journey and `Results.tsx` is the results page. |
| `shared/framework.ts` | The 25 capabilities, used by both the client and the server. |
| `server/index.ts` | The API, and the rules for moving between stages. |
| `server/content.ts` | Reads the questionnaires and briefs from `../material`. The answer key never reaches the browser. |
| `server/shared-chat.ts`, `gemini-chat.ts`, `conversation.ts`, `evidence.ts` | Turn links and files into a clean conversation. |
| `server/providers.ts`, `prompts.ts` | The Jev calls and the prompts. |
| `server/profiles.ts`, `scoring.ts` | The score calculations. |
| `server/summaries.ts` | The Claude feedback. |
| `server/worker.ts` | Runs grading in the background and saves progress. |
| `server/code-runner.ts` | The Docker test runner. |
| `server/run-exports.ts` | Writes the `student-runs` folders. |

## Tests

```sh
npm test
npm run test:e2e
```

The browser tests start their own demo server on port 4174 and use their own data folder, so they won't touch your real records. If you haven't installed a browser for them yet, run `npx playwright install chromium`. The coding test needs Docker. One test is skipped unless you point it at a finished live run with `LIVE_TEST_ATTEMPT_ID`.

The tests show that the app behaves as designed, not that its judgements about students are accurate. That still needs a study with human ratings.

## Credits

The coding task is [Codeforces 1399B](https://codeforces.com/problemset/problem/1399/B). The entrance artwork is our own Three.js scene, loosely inspired by [teamLab](https://www.teamlab.art) and using none of their work. Grading uses [Jev](https://docs.typesafe.ai/models) from TypeSafe.
