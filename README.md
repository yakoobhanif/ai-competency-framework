<p align="center">
  <img src="assets/banner.png" alt="AI Competency Framework: defining what AI competency means for university students, and measuring it from their real LLM conversations." width="100%">
</p>

AI can now write a polished essay or solve a hard problem in seconds, so finished work says much less than it used to about what a student actually knows. These tools are now widespread among students, but using AI is not the same as using it well. The issue we're trying to tackle is **cognitive offloading**: when students hand the thinking itself over to AI, they can produce good work without learning much from it. Universities need to know whether students are using AI to think better or to avoid thinking, and today they have little evidence either way.

Most AI literacy frameworks describe what students should know, or ask them how confident they feel. Neither shows what a student can actually do with AI when learning something new or creating real work. This project tries to close that gap in two ways:

1. **Define what competency means.** We reviewed academic studies and practitioner, industry, policy and university frameworks, and turned them into 25 measurable capabilities under four domains.
2. **Measure it from real work.** Students complete a self-assessment, a quiz and practical tasks, which show what they believe they can do, what they know and what they actually do. The experimental part is extracting demonstrated capabilities automatically from their transcripts with tools like ChatGPT, Gemini and Claude, because the conversation shows how the work was done and not just how it turned out.

Together, these can show a student where their real strengths are and where what they believe differs from what they show. Over time, the goal is to help universities redesign homework and assessment for the generative AI era, so that AI strengthens learning rather than replacing it, and to give universities and employers a clearer view of students' AI skills.

The work is a research pilot at the National University of Singapore.

## The framework

The 25 capabilities fall under four domains:

- **Understand AI:** how AI works, what it can and can't do, and when to use it.
- **Learn and Solve with AI:** using AI to learn something and reason through a problem.
- **Create with AI:** planning, directing and finishing real work with AI.
- **Evaluate and Use AI Responsibly:** checking claims, weighing harm and owning the final decision.

The full definitions are in [capabilities.md](capabilities.md).

## What a student does

The whole assessment takes about an hour, and it runs in this order:

1. **Self-assessment.** The student rates themselves on all 25 capabilities.
2. **Quiz.** 25 scenario questions, one per capability.
3. **Learning task.** The student studies a short lecture deck on memory and attention, however they normally would, and shares their AI transcript if they used an LLM.
4. **Creation task.** The student either writes a short essay or solves a small coding problem, and again shares their transcript.

At the end they see an analysis of their strengths and improvement areas across the four domains.

## What's in this repo

| Folder | What it holds |
| --- | --- |
| [`material/`](material) | The quiz, the self-assessment, the three task briefs and the lecture deck. The portal reads directly from here. |
| [`portal/`](portal) | The web app students use, including scoring and a reviewer screen. Its [README](portal/README.md) explains how to run it. |
| [`student-runs/`](student-runs) | Where finished assessments get saved for analysis. Student data stays on your machine and is never committed. |

## Try it

You need Node 22.13 or newer.

```sh
cd portal
npm install
npm run dev
```

Then open http://localhost:4173. It starts in demo mode unless a `.env` file says otherwise, so you can click through everything without API keys and nothing leaves your computer.
