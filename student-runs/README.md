# Student runs

Every time a student submits their final task, the portal saves a complete copy of their assessment here, ready for analysis. Git ignores everything in this folder except this README.

Each run gets its own folder, named with a unique ID rather than the student's name, so two students with the same name can't overwrite each other:

```text
student-runs/
  demo/<assessment-id>/
  live/<assessment-id>/
```

Keep demo and live runs apart when you analyse them, because the practical scores in demo runs are placeholders. To save runs somewhere else, set `RUN_EXPORT_DIR`.

## What's in each folder

| File | What it holds |
| --- | --- |
| `self_assessment.csv` | The student's rating for each of the 25 questions, with the full wording of every option. |
| `capability_quiz.csv` | The 25 quiz answers in the order this student saw them, with the correct answers and points. |
| `capability_scores.csv` | One row per capability: self-rating, quiz score, the evidence from each task and the resulting scores. |
| `domain_scores.csv` | One row per area of the framework, with scores and categories for each view of the results. |
| `creation_output_scores.csv` | How the essay or code was judged, and whether it passed. |
| `learning_transcript.txt` | The full learning conversation, or the student's note if they worked without AI. |
| `creation_transcript.txt` | The same for the creation task. |
| `creation_output.pdf`, `.docx` or `.py` | An exact copy of the essay or program they submitted. |
| `run.json` | Everything above and more in one file, including grading details and audit history. It contains no passwords or session tokens. |

## Reading the numbers

- A blank cell means the value isn't available. It doesn't mean zero.
- Self-ratings run from 1 to 5, Jev probabilities from 0 to 1, and scores from 0 to 100.
- C5 is judged only by whether the essay or code passed, so it has no Jev probability.
- A criterion can show Fail while the essay passes overall, because an essay needs only three of its five criteria at 0.70 or above, as long as all five reach 0.50.
- The `mode` and `method` columns tell you how a value was produced, so check them before combining runs.

To load a run with pandas:

```python
import pandas as pd

scores = pd.read_csv('student-runs/live/<assessment-id>/capability_scores.csv')
domains = pd.read_csv('student-runs/live/<assessment-id>/domain_scores.csv')
```

## When files change

The portal saves the submission as soon as grading starts, so nothing is lost if a model call fails. It replaces that copy with the full results when grading finishes, and updates the same folder after any re-evaluation or reviewer correction. If a save fails, the student sees an error and can retry.

## Deleting runs

These folders are permanent until you delete them by hand. A student choosing "Start fresh" or "Delete my assessment" doesn't remove them, and neither does the portal's 30-day cleanup of old sessions. Names appear inside the files, so treat the whole folder as personal data.
