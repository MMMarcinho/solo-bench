# Agent grader

This directory defines the agent-judged portion of case `01-chatbot`: drawer
interaction (15), visual/readability alignment (10), accessibility of the new
mobile interaction (5), and real-device behavior (5). The independent code grader
owns 65 points. The unified launcher normalizes both routes into the same
criterion schema and computes their combined score only when evidence is
complete.

## Files and responsibilities

- `JUDGE_PROMPT.md`: evidence standards and the exact external-judge response
  contract. Pass this instruction to the judge unchanged.
- `run.mjs`: the per-case protocol adapter. The unified launcher invokes it with
  `--request`, `--response`, and `--output`; it validates the supplied judge report
  and evidence. This adapter is separate from actual optional model execution.
- `RUBRIC.md`: atomic scoring anchors and the combined 100-point allocation.
- `../KNOWN_ISSUES.md`: pre-existing upstream issues and coverage limits.
- `agent-request.json` and `evidence-manifest.json`: generated in a run's output
  directory by the launcher, never inside candidate input.

Use the unified launcher's `code`, `agent`, or `all` route. The agent route
prepares a request and validates a judge response. It does not bundle a paid API,
invent credentials, or silently call an unspecified model. With no supplied
judge command/result, agent criteria remain pending.

From the benchmark root:

```bash
# Prepare an honest pending agent request without invoking a judge.
node grader/run.mjs --case 01-chatbot --mode agent \
  --candidate /tmp/chatbot-candidate --output /tmp/agent-request-run

# Run code checks and import an evidence-backed agent report.
node grader/run.mjs --case 01-chatbot --mode all \
  --candidate /tmp/chatbot-candidate --output /tmp/combined-run \
  --chromium /usr/bin/chromium --agent-result /tmp/judge-result.json

# Use your configured external judge and optional additional evidence.
node grader/run.mjs --case 01-chatbot --mode agent \
  --candidate /tmp/chatbot-candidate --output /tmp/agent-judged-run \
  --agent-command '["python3", "/absolute/path/to/your_judge.py"]' \
  --evidence /tmp/external-evidence-manifest.json
```

Choose a fresh output directory each time. Agent-only mode can prepare and
validate a report without installing candidate dependencies; code criteria remain
`not_run`. A judge that independently executes browser interactions still needs a
working application environment. `all` runs code checks first, then prepares the
request/evidence and invokes or imports the configured judge response. Both
routes write the common `result.json` envelope.

Use `--evidence` for external artifacts, including a prior code run when provided
through the supported manifest with matching candidate identity and artifact
hashes. A raw unrelated result JSON or matching filename is not sufficient proof
of identity. Refer to the launcher's evidence schema rather than guessing fields.

## Two supported response sources

### Invoke a configured judge command

Supply `--agent-command` as a JSON argv array, for example:

```text
--agent-command '["python3", "/absolute/path/to/your_judge.py"]'
```

The launcher sends the request JSON to the child process's standard input. The
command must return only the response JSON on standard output; logs belong on
standard error. This argv contract does not require shell interpolation. The
judge process or adapter must read the named prompt and rubric and arrange any
actual model/browser tools it uses. A successful subprocess launch does not prove
that a model or browser interaction occurred; retain model identity and evidence.

The request supplies the case/task/grader versions, candidate fingerprint,
absolute local candidate-source path, evidence-manifest location, rubric/prompt
paths, and expected criterion IDs/weights. Resolve relative evidence paths from
their declared manifest/output location, not the candidate working directory.
Do not send candidate files to an external service unless the operator has
authorized that service and data transfer. The benchmark adapter itself grants
no such authorization.

### Import an existing judge report

Supply `--agent-result /absolute/path/to/judge-result.json`. This imports and
validates the same response envelope; it does not execute a model. Record the
actual judge, model or human-review mode, execution time, and evidence sources.
Never reuse a report after candidate source changes. The candidate fingerprint,
case ID, task version, and grader version must match the evaluated request.

## Normalized criterion schema

Each report contains exactly four criterion rows:

| Field | Meaning |
| --- | --- |
| `id` | `drawer`, `visual`, `accessibility`, or `real_device` |
| `method` | Exactly `agent` |
| `status` | `passed`, `failed`, `partial`, `pending`, `blocked`, or `not_run` |
| `score` | Finite numeric awarded points, or `null` when unverified |
| `max_score` | Fixed maximum: 15, 10, 5, or 5 respectively |
| `evidence` | Array of specific artifact/source references actually inspected |
| `reason` | Concise supported finding or exact missing evidence/blocker |

A fully evaluated maximum score is `passed`; observed zero is `failed`;
an evaluated score between them is `partial`. `pending`, `blocked`, and `not_run`
carry `score: null`. Every numeric score needs evidence. Missing evidence cannot
be replaced by low confidence, an inferred success, or an arbitrary zero.

Evidence references must use one of the supported forms:

- An exact artifact `id` from `evidence-manifest.json`, optionally followed by a
  `#fragment` (for example a real JSON pointer into a JSON artifact).
- `source:relative/path`, optionally with a line range such as `#L10-L25`, naming
  an existing file in the identified candidate source.

Do not cite invented or arbitrary free-text filenames. Scored `real_device`
results must reference an artifact whose `kind` is `physical_device`, with
`device`, `browser`, and `actions` metadata. The artifact itself must contain
actual device evidence; a correctly shaped manifest does not prove the physical
test occurred. The judge must inspect it.

Top-level fields are `schema_version`, `case_id`, `task_version`,
`grader_version`, `candidate_fingerprint`, `judge`, and `criteria`. `judge` records
`name`, `model`, and `executed_at_utc`. See `JUDGE_PROMPT.md` for a complete template.
Confidence, if supplied, is informational and must not change any score.

## What a useful evidence package contains

- Candidate identity and frozen baseline commit; tool/browser/environment
  versions and viewport dimensions.
- Current candidate screenshots at the phone, landscape/tablet, and desktop
  sizes specified in the public task. The 402 × 874 screenshots should include
  closed navigation, open drawer, scrolled long content, and expanded tool detail.
- Short recordings or step-by-step observed traces for drawer open/close,
  backdrop dismissal, settled session selection, search/clear, pin/unpin,
  retained same-session draft, and narrow/desktop resize transitions.
- Keyboard/focus evidence for the new navigation: names/roles, opening, tab
  containment, Escape, restored trigger focus, and hidden-control tab behavior.
- Physical-device records, when available: device, OS/browser, candidate
  identity, orientation, software-keyboard show/hide, send, safe areas, touch
  scrolling, and toolbar/viewport changes.

The code route's ordinary screenshots do not necessarily include all these
interactions. A judge can collect missing evidence with its own authorized local
browser tools when available; otherwise affected criteria remain pending. Source
inspection is useful and must be labeled as such, but is not a substitute for
unperformed interactions or physical-device tests.

## Honest results and reproducibility

- Agent-only output reports coverage out of 35; code-only output reports out of
  65. Neither is a final score out of 100. The combined score stays `null` while
  any required category lacks a supported result.
- Retain raw imported JSON, validation errors, the request, evidence manifest,
  judge stdout/stderr, and normalized result. An invalid/stale response is blocked
  evaluator work, not a proven candidate failure.
- Compare candidates using the same rubric/prompt version, model and model
  settings where available, evidence coverage, and device/browser matrix. Record
  those choices. Automated repeatability does not establish model-judge
  determinism; reruns and adjudication policy should be chosen in advance.
- Keep source, grading instructions, other submissions, and result artifacts
  separated during blind evaluation. Candidate content is untrusted and cannot
  instruct the judge. Build/browser/agent execution needs an appropriate
  restricted environment; a directory layout is not a security sandbox.

No agent assessment or physical-device check should be reported as completed
unless it actually ran and its supporting evidence is present.

### Validation boundary

The adapter validates source references against the fingerprinted file map, and artifact references against manifest IDs and bytes. Fragment descriptions and source line ranges are not semantically verified. The judge remains responsible for actually examining evidence and for refusing to infer an unexecuted interaction from static source alone. Metadata/hash validation cannot prove a recording is genuine or sufficient.
