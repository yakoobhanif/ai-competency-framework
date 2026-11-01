# AI Capability Quiz

Version: `capability_quiz_v2.3` (approved 25-question scenario baseline)

Status: Approved wording and fixed scoring key for initial piloting; not a validated psychometric scale.

Framework: AI Competency Framework v3.0; self-assessment v2.6.

This is Part 2 of the assessment: conceptual knowledge and judgement in written scenarios. It follows self-assessment and precedes practical tasks. It contains one question for each of the 25 capabilities. **Distribute only Part A to students. Keep Parts B and C out of student-facing files, browser bundles and AI-assistant context.**

Version 2.2 implements the final questions, options and scores approved in the platform review. It replaces the 35-question version, renumbers items in capability order, and uses binary scoring throughout, including R3/R4. Existing answers must not be relabelled across versions.

Version 2.3 rewrites answer options so the four options in each question are similar in length and the best answer does not stand out by being longer or more qualified. Absolute wording such as “always” and “necessarily” is removed from distractors. Questions, the best answer to each question and the scoring key are unchanged.

## Part A. Student Quiz

### Instructions

Answer the following **25 questions** about understanding and using AI.

- Allow about **20 minutes**. The timer is a guide; you can take the time you need.
- Choose **one best answer, A-D**, for each question. Some options may be partly reasonable; select the one that best fits the situation.
- Use the information and tool settings stated in each question. Do not assume additional features, permissions or access.
- If you are unsure, select **Not sure** rather than guessing.
- Work on your own, without AI, searches, notes or help from someone else.
- The best answer earns 1 point. Other answers and Not sure earn 0; there are no negative marks or partial credit.
- You can review and change your answers before submitting. Feedback is provided after the assessment, not between questions.

### Q01. Learning from Examples

An AI system is trained on thousands of photographs labelled with the animals they show. It then identifies an animal in a photograph it has never seen. What best explains how it does this?

A. It finds the training photograph closest to the new one and copies its label without considering other examples.

B. During training, it learned patterns associated with the labels and uses those patterns to make a prediction.

C. The labels gave it a full definition of each animal, which it checks against the new photograph.

D. It adds the new photograph to its training data and learns the correct label before making its prediction.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Copy the closest training photo |
| B | Predict from learned patterns |
| C | Treat labels as complete definitions |
| D | Train on the new photo |

### Q02. Judging a Convincing Answer

AI has been useful for improving your essays. You now ask it about a topic you know little about, and its answer sounds convincing. Which judgement is most reasonable?

A. A clear explanation is a good reason to trust the answer, even on a subject you cannot judge yourself.

B. Getting the same answer in several new conversations would show that the answer is accurate.

C. Asking it to answer as a subject expert would make the response reliable enough to use.

D. Its skill at editing says little about this subject, so check the answer before relying on it.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Trust a clear explanation |
| B | Confirm through repeated answers |
| C | Request a subject expert |
| D | Check reliability for this task |

### Q03. Choosing a Survey Workflow

You have 800 survey responses, each with a faculty name and a written comment. You need recurring themes and exact response counts by faculty. Your approved AI tool can read text but cannot run calculations. Which workflow fits best?

A. Ask AI for both outputs and accept its counts once you have checked ten responses by hand.

B. Calculate faculty totals in a spreadsheet and use the most frequent words to describe the themes.

C. Calculate faculty totals in a spreadsheet, use AI to suggest themes, and check those themes against the comments.

D. Ask AI to analyse a sample, then scale its faculty counts up to represent all 800 responses.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Ask AI and spot-check counts |
| B | Count totals and frequent words |
| C | Calculate totals and check themes |
| D | Scale up a sample |

### Q04. An Essay Score Without the Rubric

You ask AI to assess your essay using your course’s marking rubric. You provide the essay and assignment brief, but the rubric is on a private course page you have not shared. The AI gives a detailed score. How should you interpret it?

A. Its comments may help, but the score is not based on the actual rubric, so share it first.

B. The level of detail in the score suggests it recognized the course’s rubric from the brief.

C. Adding the course name and lecturer’s name would let it reconstruct the private rubric accurately.

D. If another AI gives a similar score, that confirms both assessed the essay against the actual rubric.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Share the actual rubric |
| B | Infer rubric from detailed score |
| C | Reconstruct rubric from course names |
| D | Confirm with another AI |

### Q05. Recognizing AI in an Email App

Which email-app feature most clearly shows AI learning from data, rather than following a fixed setting or sorting rule?

A. Moving messages into a folder whenever the sender’s address matches a list you created.

B. Flagging unfamiliar messages as likely scams based on patterns learned from previous scam messages.

C. Displaying messages from newest to oldest and grouping those with identical subject lines.

D. Sending an automatic reply during the dates you entered for your holiday.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Sort by a sender list |
| B | Detect learned scam patterns |
| C | Sort dates and group subjects |
| D | Schedule automatic holiday replies |

### Q06. Recent AI Developments

As of November 2026, which statement accurately describes a recent AI development and what it means?

A. Multimodal assistants can interpret screenshots, giving them access to the underlying files and apps without needing those files opened or connected.

B. Newly launched personal assistants can continue working between conversations and act across connected apps, with access and approvals governed by permissions.

C. Downloadable AI models let people run the models themselves, which also makes their complete training records available for inspection.

D. Reasoning models can spend longer working through problems, making their displayed explanations a verified record of how each answer was reached.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Access files through screenshots |
| B | Use persistent assistants across apps |
| C | Inspect downloadable models’ training records |
| D | Trust displayed reasoning as verified |

### Q07. What an Attention Head Does

What does an attention head do when a transformer processes text?

A. It uses values to score the relevance of keys, then combines query representations using those scores.

B. It slides a learned filter over fixed groups of neighbouring tokens, then pools the resulting features.

C. It scores how relevant available tokens are to a token, then combines their information using those weights.

D. It starts with a noisy representation and repeatedly predicts and removes noise to recover the text.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Score keys using values |
| B | Apply local filters and pooling |
| C | Combine token information with weights |
| D | Remove noise in repeated steps |

### Q08. An Outdated Policy Answer

An LLM-based university assistant gives an outdated policy answer. Its search tool found the current policy, but the system passed an older saved passage to the LLM. What would address the problem most directly?

A. Replace the LLM with a larger model, keeping the same passages and the same flow of information.

B. Fix how retrieved passages are selected and passed to the LLM, then check the current one arrives.

C. Instruct the LLM to use the latest policy, while it keeps receiving the same older passage.

D. Add a step where the same LLM reviews its answer against the older passage it was given.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Switch to a larger model |
| B | Pass the current policy passage |
| C | Request the latest policy |
| D | Check against the older passage |

### Q09. How an Agent Chooses Its Next Step

You ask an AI assistant to find a suitable meeting time. It checks calendars, finds no common slot, asks about flexibility and searches again. What best explains this behaviour?

A. It uses what its tools return to decide its next step, instead of following a fixed script.

B. It was given a separate, prewritten instruction for each type of calendar conflict it might meet.

C. Reading the calendars retrains the underlying model, giving it the knowledge it needs for the next step.

D. Once connected to the calendars, it can decide which access restrictions to override to finish the task.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Choose actions from tool results |
| B | Follow prewritten calendar instructions |
| C | Retrain by reading calendars |
| D | Override calendar access restrictions |

### Q10. Choosing a Learning Goal

While studying with AI, you notice that you can solve problems when told which formula to use, but often choose the wrong formula when questions are worded differently. Which learning goal best addresses this difficulty?

A. Memorize the formulas more thoroughly so you can recall each one faster under exam conditions.

B. Practise calculations with each formula until you can do the arithmetic quickly and without mistakes.

C. Learn which features of a problem decide the method, and explain your choice before calculating.

D. Read more worked solutions so you can recognize which familiar example each new question resembles.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Memorize formulas for faster recall |
| B | Practise calculations with each formula |
| C | Explain which method fits |
| D | Recognize familiar worked examples |

### Q11. Checking Learning Later

You study a topic with AI and answer questions correctly immediately afterwards. Two days later, you struggle to answer similar questions without help. How should you adjust your study approach?

A. Test yourself without hints a day or two later, and use your mistakes to decide what to revisit.

B. Reread the AI’s explanation before each practice attempt so that you keep getting most answers right.

C. Repeat the original questions straight away until they feel easy, and take that as a sign you know it.

D. Ask AI for more detailed notes, and wait to test yourself until they cover the whole topic.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Test without hints days later |
| B | Reread before each practice attempt |
| C | Repeat original questions immediately |
| D | Complete detailed notes before testing |

### Q12. Interpreting Email Warnings

An inbox contains 1,000 emails, including 10 scams. A filter marks 9 scams and 99 normal emails as “suspicious.” An AI study assistant says: “The filter found 9 out of 10 scams, so a suspicious email is 90% likely to be a scam.” Which reply is correct?

A. “Yes. Finding 90% of the scams means its warnings are right 90% of the time.”

B. “No. It correctly flagged 9 out of 1,000 emails, so a suspicious email is only 0.9% likely to be a scam.”

C. “It marked 108 emails as suspicious, but only 9 were scams. Most of its warnings were about normal emails.”

D. “We cannot tell whether its warnings are usually right without knowing which words it looks for.”

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Equate detection with warning accuracy |
| B | Use all emails as denominator |
| C | Compare scams with all warnings |
| D | Inspect the filter’s chosen words |

### Q13. Applying a Fair-Test Principle

While studying with AI, you learn why testing a fertilizer while also changing the amount of water makes its effect hard to judge. You now want to test whether AI feedback helps students revise essays better than ordinary feedback. Which plan applies the same lesson?

A. Let students choose their preferred feedback, then compare their revised essays using the same marking criteria.

B. Give the AI-feedback group extra revision time so they can make full use of the tool, then compare final marks.

C. Assign students by chance to the two feedback groups, using the same assignment, revision time and marking criteria.

D. Compare this year’s students using AI feedback with last year’s students using ordinary feedback on a different assignment.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Let students choose their feedback |
| B | Give AI users more time |
| C | Assign groups under matched conditions |
| D | Compare different years and assignments |

### Q14. Briefing a Poster

Your student society wants a poster encouraging first-year students to register for a free careers workshop. Which brief gives AI the clearest direction for an effective poster?

A. “Create an informative A4 poster about career planning, covering industry trends and full biographies of each speaker.”

B. “Create an A4 poster for first-year students with the workshop’s benefits, date, location and registration link.”

C. “Create a professional A4 poster that emphasizes our society’s achievements and uses the university’s colours and branding.”

D. “Create a striking A4 poster with an inspirational careers message, keeping practical details separate to avoid clutter.”

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Explain careers and speaker backgrounds |
| B | Promote workshop benefits and registration |
| C | Emphasize society achievements and branding |
| D | Use inspiration without practical details |

### Q15. Planning an Event Recommendation

Two students are using AI to recommend an event for their student society. They have a survey of members’ event preferences and a list of possible venues. Some survey responses are duplicates, and venue prices need confirming. The recommendation must balance member interest with the budget. Which plan handles the work best?

A. One removes duplicate survey responses and the other confirms prices while AI drafts slides. AI then compares options, and both review.

B. AI chooses an event first. They then fix the survey and update prices, keeping the choice unless it exceeds the budget.

C. One student picks the cheapest venue. The other asks AI to use the survey to explain why members would enjoy it.

D. One student ranks events by popularity, the other by price, and AI goes with whichever ranking shows a clearer winner.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Check inputs before comparing options |
| B | Keep the initial affordable choice |
| C | Justify the cheapest venue |
| D | Choose the clearest single ranking |

### Q16. Supplying Comparable Cost Information

You want AI to help compare the cost of attending two universities for a year. University A quotes $18,000 including accommodation and meals. University B quotes $12,000 for tuition only. You have both universities’ reports. How should you prepare the information for AI?

A. Give both figures and their sources under the heading “annual cost,” asking AI to rank the universities from cheapest to most expensive.

B. Give both reports and ask AI to fill in any missing costs using typical student expenses, presenting the resulting totals as confirmed figures.

C. Remove accommodation and meals from A’s figure, compare tuition alone, and ask AI to describe the result as the overall cost comparison.

D. Give each figure with its source, date and what it covers, and keep estimates for missing costs clearly separate.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Rank headline annual cost figures |
| B | Treat typical expenses as confirmed |
| C | Present tuition as overall cost |
| D | Separate confirmed costs and estimates |

### Q17. Revising an Interview-Based Assignment

AI helps you draft an interview-based assignment. The draft says a company requires employees to work at weekends. The interviewee clarifies that they were describing their own voluntary practice, not company policy. What is the best revision?

A. Correct the interview quotation, but leave the assignment’s summary and its argument as they are.

B. Keep the company-policy claim but add a note that interviewees’ views may be personal.

C. Correct the claim throughout and revise any argument that relied on it being company policy.

D. Ask AI to change “requires” to “encourages,” keeping the company-policy framing with softer wording.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Correct only the interview quote |
| B | Keep claim with a disclaimer |
| C | Revise connected claims and arguments |
| D | Soften the company-policy wording |

### Q18. Checking an AI-Assisted Presentation

You use AI to turn your research report into a five-minute class presentation. The slides look professional, and you have checked that every quoted number and citation matches the report. What is the most useful final check before presenting?

A. Check that fonts and colours are consistent, since matching numbers and citations show the content is faithful.

B. Rehearse aloud, checking that headings and charts keep the report’s meaning, explanations are clear and timing fits.

C. Add a link to the full report so the audience can look up any missing explanations or caveats.

D. Ask AI to rate the slides against the assignment brief, and treat a good rating as confirmation they are ready.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Check fonts and colours |
| B | Rehearse meaning, clarity and timing |
| C | Link the full report |
| D | Rely on AI’s readiness rating |

### Q19. Supervising a Public Skill

You want an AI agent to use a publicly shared skill to format your presentation. The skill contains instructions and a script that reads project files. What should happen before it works on your presentation?

A. Review the script for unsafe code; the written instructions are not executable, so they can be trusted.

B. Check the instructions and code for hidden directions or data exposure, then test on a copy with minimal access.

C. Limit access to the project folder and test on a copy, but trust the skill’s written instructions as given.

D. Tell the agent to ignore any malicious instructions, and then let it run the skill with its normal access.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Review code but trust instructions |
| B | Review redirection risks and permissions |
| C | Limit access but trust instructions |
| D | Warn the agent before running |

### Q20. Checking a Study Behind a Claim

An AI cites a study to support an important claim in your assignment. What is the best way to check whether the study actually supports that claim?

A. Find the study, read the relevant findings, and compare what it examined and found with the claim.

B. Ask the same AI to confirm that the reference is genuine and explain its answer again.

C. Check that the reference has a realistic title, named authors and a plausible publication date.

D. Look for another AI response that makes the same claim and also cites the same study.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Read and compare original findings |
| B | Ask the same AI again |
| C | Check the reference looks realistic |
| D | Find another matching AI answer |

### Q21. Interpreting Accuracy and Refusals

Two AI tools receive the same 100 questions. Tool A answers all of them and gets 80 right. Tool B answers 40, gets 38 right and declines the other 60. A review calls B “more capable” because its accuracy is 95%, compared with A’s 80%. How should you assess that claim?

A. Accept it: B gets a higher share of its answers right, so it is the more capable tool.

B. Reject it: A answers every question, and answering is more useful than declining, even with some mistakes.

C. Count B’s refusals as successes, because declining to answer is safer than risking a wrong answer.

D. Look at which questions B declined: some refusals may be sensible, others not. Then compare the tools.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Prefer the higher accuracy percentage |
| B | Prefer answering over every refusal |
| C | Count every refusal as successful |
| D | Assess refusals, errors and usefulness |

### Q22. Reviewing Career Stories for Stereotypes

A university careers service uses an LLM to draft fictional career stories for a guide. Most leadership and engineering examples feature men, while most supporting and caring roles feature women. What is the best response?

A. Retain the stories if these patterns appeared frequently in the training material, because that makes the selection neutral.

B. Add a separate “women in engineering” box, treating that addition as sufficient without reviewing the main stories.

C. Add a disclaimer that AI may reproduce stereotypes, leaving readers to interpret the stories themselves.

D. Revise the stories to show varied people in different roles, then check the whole guide for stereotypes.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Treat training patterns as neutral |
| B | Add a women in engineering box |
| C | Keep stories with a disclaimer |
| D | Revise roles and check stereotypes |

### Q23. Sharing Interview Excerpts Safely

Your course permits uploading interview excerpts to an approved AI service only if participants cannot be identified. You have removed names, but an excerpt still gives an exact job title, department and a distinctive workplace incident. What should you do?

A. Upload it as it is, since removing the names is enough to make the excerpt anonymous.

B. Replace the job title with initials, keeping the department and incident so the AI has context.

C. Remove or generalize the identifying details, recheck the text, and share only the excerpts you need.

D. Use a temporary chat and tell the AI not to include identifying details in its response.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Remove names before uploading |
| B | Replace job titles with initials |
| C | Remove identifying details; share less |
| D | Use temporary chat; anonymize response |

### Q24. Following the Limits on AI Assistance

Your assignment allows AI to help with structure and language, but the analysis must be your own. You ask AI to reorganize your notes. It adds a new interpretation of a source, which you keep after rewriting it in your own words. You have cited the source. What should you do before submitting?

A. Disclose help with structure and language only, since rewriting the interpretation made it your own analysis.

B. Redo that part of the analysis yourself, as the rules require, and describe accurately what AI contributed.

C. Cite the AI next to the interpretation, because acknowledging where it came from makes the use allowed.

D. Describe all of the analysis as AI-generated, since a broader disclosure is safer than separating contributions.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Disclose structure and editing only |
| B | Rework analysis and disclose accurately |
| C | Cite AI to permit use |
| D | Label all analysis AI-generated |

### Q25. Deciding What Is Ready to Publish

You used AI to help prepare an article. Your checks support its main content, but an allegation about a named person remains unsupported. The allegation is not essential to the article. What should you do?

A. Publish the article as it is, since most of its content has already passed your checks.

B. Publish the allegation with a note that AI helped, so readers can judge it for themselves.

C. Keep the allegation if the AI repeats it confidently after you ask it to reconsider the claim.

D. Leave out the allegation unless evidence supports it, and judge the rest of the article on its merits.

Answer: **A / B / C / D**

Review labels:

| Option | Summary |
| --- | --- |
| A | Publish because most checks passed |
| B | Publish with an AI disclosure |
| C | Seek a more confident answer |
| D | Withhold allegation; assess supported content |

### Submit

Review your answers, then submit.

**End of student quiz. Do not distribute the material below during assessment.**

## Part B. Confidential Answer Key and Blueprint

### 1. Design Basis

One question samples each capability. Scenarios use clear language and plausible mistakes; technical language is retained where the capability calls for it. These are knowledge/judgement indicators, not demonstrations of practical mastery. Each option also has a manually authored neutral review label. The labels summarize selections without revealing marks or identifying the best answer; they are shown only on the review page. The self-assessment remains separate from performance scores.

The approved U6 item is anchored to November 2026; it does not ask for a brand name or infer how frequently the student follows AI news. The approved U7 item probes attention within a transformer; it does not establish comprehensive architecture mastery. C6 concerns supervising a public skill, including prompt injection as well as executable code and permissions.

L3 uses conditional-probability reasoning with natural counts. L4 tests recognition of a fair-test principle applied to a different setting. Learning and creation questions provide baselines that can later be supplemented by practical-task evidence. R3/R4 now use the same binary scoring as every other capability.

### 2. Coverage and Fixed Scoring Key

Award the points below for the selected option. All questions have one best answer worth 1 and three other answers worth 0. Not sure earns 0. A missing response is unknown, not a wrong answer.

| Item | Capability | Focus | Role | A | B | C | D | Maximum |
| --- | --- | --- | --- | ---: | ---: | ---: | ---: | ---: |
| Q01 | U1 | Learning from Examples | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q02 | U2 | Judging a Convincing Answer | Quiz baseline | 0 | 0 | 0 | 1 | 1 |
| Q03 | U3 | Choosing a Survey Workflow | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q04 | U4 | An Essay Score Without the Rubric | Quiz baseline | 1 | 0 | 0 | 0 | 1 |
| Q05 | U5 | Recognizing AI in an Email App | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q06 | U6 | Recent AI Developments | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q07 | U7 | What an Attention Head Does | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q08 | U8 | An Outdated Policy Answer | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q09 | U9 | How an Agent Chooses Its Next Step | Quiz baseline | 1 | 0 | 0 | 0 | 1 |
| Q10 | L1 | Choosing a Learning Goal | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q11 | L2 | Checking Learning Later | Quiz baseline | 1 | 0 | 0 | 0 | 1 |
| Q12 | L3 | Interpreting Email Warnings | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q13 | L4 | Applying a Fair-Test Principle | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q14 | C1 | Briefing a Poster | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q15 | C2 | Planning an Event Recommendation | Quiz baseline | 1 | 0 | 0 | 0 | 1 |
| Q16 | C3 | Supplying Comparable Cost Information | Quiz baseline | 0 | 0 | 0 | 1 | 1 |
| Q17 | C4 | Revising an Interview-Based Assignment | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q18 | C5 | Checking an AI-Assisted Presentation | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q19 | C6 | Supervising a Public Skill | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q20 | R1 | Checking a Study Behind a Claim | Quiz baseline | 1 | 0 | 0 | 0 | 1 |
| Q21 | R2 | Interpreting Accuracy and Refusals | Quiz baseline | 0 | 0 | 0 | 1 | 1 |
| Q22 | R3 | Reviewing Career Stories for Stereotypes | Quiz baseline | 0 | 0 | 0 | 1 | 1 |
| Q23 | R4 | Sharing Interview Excerpts Safely | Quiz baseline | 0 | 0 | 1 | 0 | 1 |
| Q24 | R5 | Following the Limits on AI Assistance | Quiz baseline | 0 | 1 | 0 | 0 | 1 |
| Q25 | R6 | Deciding What Is Ready to Publish | Quiz baseline | 0 | 0 | 0 | 1 | 1 |

Maximum-answer vector: B,D,C,A,B,B,C,B,A,C,A,C,C,B,A,D,C,B,B,A,D,D,C,B,D.

### 3. Rationales

#### Q01 / U1 — B

Learning patterns from labelled examples supports prediction on new inputs. Matching a single stored photograph, treating labels as complete definitions, and assuming a known correct label before prediction misdescribe the stated process.

#### Q02 / U2 — D

Reliability depends on the task. Fluency, repeated generated answers and an expert-role request do not independently establish subject accuracy.

#### Q03 / U3 — C

Inspectable calculations address exact counts, while checked AI-assisted interpretation supports themes. A small spot check or extrapolation does not establish exact totals, and word frequency alone is not a complete interpretation of themes.

#### Q04 / U4 — A

The actual rubric is missing. Detail, course identifiers and agreement between AI outputs do not establish access to that private information.

#### Q05 / U5 — B

Learned scam-pattern recognition is the stated learned-AI feature. The other described functions follow explicit settings or sorting rules; automation alone does not establish learned AI.

#### Q06 / U6 — B

Persistent permissioned personal assistants are the approved time-specific development. Screenshot understanding does not grant underlying file access, downloadable weights do not by themselves disclose all training records, and displayed reasoning is not a verified internal trace. The self-assessment captures frequency of keeping up; this quiz item samples current awareness and interpretation.

#### Q07 / U7 — C

Self-attention uses query-key compatibility to weight value representations. A confuses the Q/K/V roles; B describes convolution and pooling; D describes iterative denoising rather than the function of an attention head.

#### Q08 / U8 — B

The stated failure is in information selection and delivery to the LLM. A larger model, an instruction without current evidence, or checking against the same old passage does not directly repair that system failure.

#### Q09 / U9 — A

The scenario illustrates a tool-action-feedback loop. It does not require an exhaustive fixed sequence, imply retraining, or grant authority to override permissions.

#### Q10 / L1 — C

The identified need is selecting and justifying a method from problem features, not formula recall, arithmetic fluency or surface resemblance to examples.

#### Q11 / L2 — A

An independent check at the time the difficulty appears supplies evidence to guide further study. Immediate familiarity or supported success does not resolve the stated difficulty.

#### Q12 / L3 — C

Among flagged messages, 9 of 108 are scams. The proportion of scams detected is not the proportion of warnings that are correct. The whole inbox is also the wrong denominator, and the stated counts suffice without knowing the filter vocabulary.

#### Q13 / L4 — C

The student transfers control of alternative explanations from the fertilizer example to an essay-feedback comparison. Self-selection, different revision time and different cohorts/assignments introduce other explanations.

#### Q14 / C1 — B

The brief connects the intended audience and registration goal to usable content and a clear next action. General information, branding or inspiration alone does not address that full purpose.

#### Q15 / C2 — A

The plan divides independent checks, respects the dependency of a recommendation on checked inputs, delegates suitable work and preserves a joint review. The other plans lock in a choice or use one criterion without balancing both.

#### Q16 / C3 — D

The selected inputs preserve scope, provenance and uncertainty. Relabelling unlike figures, treating estimates as confirmed or presenting tuition alone as overall cost creates a misleading comparison.

#### Q17 / C4 — C

The correction must be carried through the connected claims and reasoning. A local quotation change, disclaimer or softer unsupported policy claim does not resolve the substantive error.

#### Q18 / C5 — B

A usable final presentation must preserve meaning, communicate clearly and fit the required time. Correct isolated numbers, attractive formatting, a report link or AI reassurance alone does not establish readiness.

#### Q19 / C6 — B

Supervision includes reviewing both instructions and code for task redirection or unauthorized actions, then testing with bounded permissions. Code-only review, trusting task instructions or relying on a warning alone misses prompt-injection risk.

#### Q20 / R1 — A

Independent inspection of the underlying evidence checks actual support and scope. Reassurance, plausible reference formatting and repeated generated claims do not.

#### Q21 / R2 — D

Accuracy on answered questions alone does not establish overall capability. Inspect coverage and refusal appropriateness in context: neither every answer nor every refusal is automatically preferable.

#### Q22 / R3 — D

The response addresses the portrayals throughout the fictional guide. Training frequency does not establish neutrality, and a token addition or disclaimer alone does not address the remaining stereotypes.

#### Q23 / R4 — C

Indirect details can identify a participant in combination. Review and minimize what is shared under the stated course rule; removing names, changing the chat mode or controlling the output does not by itself remove identifying content from the upload.

#### Q24 / R5 — B

The stated rule separates permitted structural/language help from student analysis. Paraphrasing and citation do not make every use permissible; disclosure must accurately distinguish contributions rather than understate or overstate them.

#### Q25 / R6 — D

Withholding the unsupported allegation while assessing supported material is proportionate to the evidence and possible harm. Other verified claims, disclosure and model confidence do not justify this allegation.

### 4. Reference notes

These references support design or technical interpretation; they do not validate this original quiz or supply empirical score thresholds.

- Transformer attention: Vaswani et al., section 3.2, https://arxiv.org/abs/1706.03762.
- Recent personal-assistant developments: September 2026 launch announcements, https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent and https://openai.com/index/introducing-dots/.
- Conditional reasoning and transfer design informed the review process; the final L3/L4 items use the explicitly approved email-filter and fair-test scenarios, not the earlier discarded card-selection question.

## Part C. Administration, Calculation and Release

### Administration

Use capability_quiz_v2.3 and capability_quiz_key_v2.3 with self-assessment v2.7. Present only Part A, one question at a time, identically for both creation pathways. Allow approximately 20 minutes with a non-blocking timer and approved accommodations. With self-assessment and the two tasks, the core flow is approximately 65 minutes; practical-task buffer time remains separate.

Question order is shuffled once for each student and saved, so it stays the same across reloads. Option order stays fixed. Answers and scores always use the question ID, not the position. Save responses server-side, permit back-navigation before submission and require an explicit answer or Not sure for every item. Do not reveal the key before completion or let AI answer the quiz. Record any technical interruption separately; it is not a wrong answer. Freeze instrument versions and reject attempts from an incompatible version rather than silently mixing forms.

### Baseline calculation

For each capability, Q = 100 x earned points / planned maximum. Each of the 25 capabilities has exactly one question, worth 1 for the best answer and 0 for every other answer. There is no partial credit or negative marking. The complete key totals 25 points, an internal checksum, not an overall competency score. Dimension indices give each capability equal weight.

Not sure is zero. A missing response is unknown: retain the planned denominator and withhold the capability baseline. The one-item baselines are coarse scenario judgements, not precise estimates of practical skill. C5's quiz item concerns recognizing a usable deliverable; its actual task outcome remains distinct evidence.

### Practical evidence and dimensions

Store four independent profiles: quiz only, quiz plus learning, quiz plus creation, and quiz plus both. Jev returns a NOUL probability E between 0 and 1 for each capability in each transcript. A probability below 0.70 adds nothing. Otherwise the task boost is 0.5 x (100 - Q) x E, added to Q. The combined profile adds the larger of the two task boosts for each capability, so overlapping evidence counts once. Practical evidence never lowers a quiz result. Absent or pending evidence preserves Q, and pending evidence is flagged. No-AI accounts are never scored as transcripts.

For C5, evidence comes only from the deliverable: Pass gives E = 1, Fail gives E = 0, and Pending gives no adjustment. C5 receives no transcript score. The full rules are in `portal/docs/scoring-contract.md`.

A dimension is the equal-weight mean of its capabilities, and it needs at least 80% capability coverage before a category is released. Internal indices below 50 are Developing, 50 to below 75 Established, and 75 or above Strong; these are provisional display conventions, not validated proficiency thresholds. The student results page displays dimensions and qualitative categories only, never numerical or capability-level scores.

Self-assessment never enters performance calculations. For a separate, dashed visual overlay only, average available self-ratings within a dimension and project the 1-5 scale onto the chart radius using (mean - 1) x 25, with the same 80% minimum. This geometric alignment does not make the constructs equivalent. Never calculate an overconfidence score or describe view changes as learning gains.

### Release and audit

Retain instrument, content and scoring versions, opaque attempt ID, selected options, timestamps, mode, original-upload hashes, Jev probabilities and report history. The portal removes the student's name and email-like strings before sending work to a model. The answer key and rationales stay on the server. Human adjudication and re-evaluation create auditable revisions.

Prepare five cached feedback summaries for the five results chapters: quiz, quiz with self-assessment, learning with self-assessment, creation with self-assessment, and both tasks with self-assessment. Summaries receive only capability definitions and the numbers visible in that chapter, never raw transcripts. A plain template is used if the LLM is unavailable or returns invalid output.

### Validation checklist

- 25 unique questions; four choices and exactly one answer worth 1 point per question. All other options score 0.
- Each of the 25 capability IDs is represented exactly once, in framework order. No question scores two capabilities.
- Full-credit checksum: 25. The key and rationales stay on the server.
- Correct, incorrect, Not sure and missing responses have deterministic tests for every capability.
- Demo and live serve the same public questions without the key.
- Browser checks cover all prompts and options, saved responses, review, submission and the question count.
