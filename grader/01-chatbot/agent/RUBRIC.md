# 01-chatbot: agent rubric and combined scoring contract

This file is evaluator material. Supply the task prompt, baseline application, and
design references to the candidate, not this directory or previous grading
artifacts. The public prompt must disclose the acceptance requirements; keeping
the evaluator separate must not create surprise requirements.

The agent grader owns `drawer`, `visual`, `accessibility`, and `real_device`
(35 points). The separate code grader owns the other 65 points. The full
allocation is included here so neither route can inflate its partial coverage
into a score out of 100. An agent judge may inspect candidate source and supplied
evidence, or perform documented authorized interaction checks; every finding must
state its evidence basis. Importing a judge JSON file is not evidence that this
launcher called a model.

## Scope and evidence

The task is a mobile adaptation of the supplied React chatbot, with desktop
behavior preserved. The upstream commit is
`609b54a171d6536357810ec9baf1d0785c30fff1` from
[MMMarcinho/chatbot-baseline](https://github.com/MMMarcinho/chatbot-baseline/tree/609b54a171d6536357810ec9baf1d0785c30fff1).
The three images and accompanying static HTML/CSS in `attachment/` are layout
references. They are not a replacement application or an exact-content oracle.

Judge observable behavior and readable, usable layout. Do not award points for
particular libraries, component names, CSS properties, breakpoint values, line
counts, or matching a screenshot pixel for pixel. Do not require copying the
iPhone status bar, Dynamic Island, home indicator, static message text, or sample
session names into the web app. A different implementation with the same usable
outcome receives the same credit.

Record candidate revision or file fingerprint, baseline revision, runner version,
browser version, operating system, viewport, and the evidence file for each
check. Use the same declared matrix, thresholds, fixtures, and score rules for
every candidate in a comparison. A changed rubric or test matrix is a new
benchmark version, not a silent adjustment to one candidate's score.

Use a clean browser context for each independent scenario. Wait for the initial
history to settle before scored ordinary navigation. The deliberately slow first
query and existing race/subscription/scrolling defects are diagnostic, as detailed
in [KNOWN_ISSUES.md](../KNOWN_ISSUES.md). They do not create a requirement to repair
unrelated baseline behavior.

The declared viewport matrix, in CSS pixels, is:

- Phones: 360 × 800, 390 × 844, 402 × 874 (reference size), and 430 × 932.
- Intermediate/landscape sanity checks: 768 × 1024 and 844 × 390. No exact
  breakpoint or tablet navigation treatment is mandated.
- Desktops: 1280 × 900 and 1440 × 900.

At every size, read the actual running candidate. Phone checks require the
conversation to use the available primary content area rather than retain the
300 px desktop sidebar. Intermediate sizes must retain a visible composer and
readable, contained conversation. Repeat agent-reviewed interactions at 402 × 874 and
at least one smaller phone size; inspect all matrix screenshots for layout
regressions. Real-device findings are a separate category.

## Score allocation

| ID | Maximum | Method | Observable outcome |
| --- | ---: | --- | --- |
| `build` | 10 | Automated | The candidate has no new TypeScript diagnostics beyond the exact documented upstream exception, and its Vite production build succeeds. |
| `desktop_core` | 15 | Automated | Desktop retains the session list and usable conversation; ordinary settled session selection and local sending work. |
| `mobile_geometry` | 20 | Automated | The declared narrow viewports have a usable single-conversation view, contained messages, and a visible, unobscured composer. |
| `mobile_send` | 10 | Automated | Sending a unique local message appends it once and clears the input at the tested mobile sizes. |
| `long_content` | 10 | Automated | Existing long URL, code, and filename text remain present and contained; code can be read without widening or clipping the page. |
| `drawer` | 15 | Agent | Mobile session navigation opens, closes, selects, searches, and preserves ordinary functionality. |
| `visual` | 10 | Agent | The reference hierarchy and detail readability carry through to a coherent mobile layout. |
| `accessibility` | 5 | Agent | Mobile controls and the new navigation surface have usable names, keyboard behavior, and focus handling. |
| `real_device` | 5 | Agent | A real mobile browser verifies keyboard, viewport/safe-area, orientation, and touch behavior. |
| **Total** | **100** | **65 code + 35 agent** | |

Each automated category is all-or-nothing in this v0: all its subchecks must pass
to earn that category's points. For example, one failed tested viewport fails
the entire 20-point geometry category. Agent categories allow the per-point
partial credit defined below. Automated subchecks and their exact thresholds are
defined by the versioned runner. Record actual measurements and assertions, not
only a single boolean.
A test must not pass solely because content is present in the DOM, because a
candidate exposes a success flag, or because the page has `overflow: hidden`.
Verify visible bounds and meaningful interaction; clipped content is a failure.
If a selector is incompatible with an otherwise valid implementation, report the
specific evaluator compatibility issue rather than silently substituting an
unrelated element or claiming the functional requirement was disproved.

### Score reporting and gates

- Report automated points as `x / 65`, with individual results, and agent points
  as `y / 35` only after all agent criteria have evidence. Do not rescale `x / 65`
  to a claimed score out of 100.
- Every unreviewed agent item remains `null` / pending. A missing browser,
  unavailable device, or failed evaluator setup is unverified, not evidence that
  the candidate failed. A skipped test earns neither points nor a fabricated
  zero. Never drop pending weight from the denominator.
- `final_score` remains `null` until all scored checks are evaluated. The report
  may show a provisional automated subtotal and an applicable score cap; those
  are not a final score. Record the reason for every pending result.
- A verified candidate-caused build failure caps the eventual score at **0**.
  A registry outage, unavailable browser binary, or runner exception is not a
  candidate-caused build failure.
- A verified failure of either automated category `desktop_core` or `mobile_send`
  caps the eventual score at **49** in this v0. This deliberately conservative
  gate applies to any failed subcheck in those two categories, not only a
  completely unusable conversation. A pending/incompatible evaluator check is
  not a verified failure. Reports must identify the exact failed action and
  distinguish it from a known upstream issue; agent-evaluated style differences alone
  do not trigger this gate.
- Otherwise, `final_score = min(sum(all item scores), applicable cap)`. Keep the
  uncapped sum and gate explanations in the report. A gate never converts missing
  agent evidence into completed review.

### Exact upstream TypeScript exception

A clean upstream install lacks Node type declarations and produces these two
diagnostics from its build configuration:

```text
vite.config.ts(1,18): error TS2307: Cannot find module 'node:path' or its corresponding type declarations.
vite.config.ts(9,25): error TS2304: Cannot find name '__dirname'.
```

The grader may accept exactly these pre-existing diagnostics, or a clean
typecheck, for the build category. Any additional diagnostic is a candidate build
failure. It must independently run the Vite production build and require success.
Evidence must retain the actual compiler exit status and diagnostics and label
the known-baseline exception; do not report that TypeScript or the unmodified
`npm run build` passed when they did not. Optional candidate repair of the missing
typings earns no extra points. See [KNOWN_ISSUES.md](../KNOWN_ISSUES.md).

## Agent scoring procedure

Record the candidate identity, reviewer, date, tested viewport/device, reproduction
steps, and screenshots or a short recording. Keep evidence outside the candidate
input tree. Use `JUDGE_PROMPT.md` and the protocol in `README.md`. A human may
produce the same evidence-backed report, but must identify that mode; it is not a
model evaluation. Static source inspection can support structural findings, but
cannot establish that an unperformed interaction or real-device test succeeded. Each numbered atomic condition below is worth one point, except
where a three- or four-point subsection lists that many atomic conditions.
Award one point only when the observed condition is met; award zero when an
observed failure is reproducible. Leave the item pending if any needed condition
has not been reviewed. This gives partial credit without subjective percentages.

Reproduce suspected regressions on the frozen baseline at desktop when relevant.
Do not deduct twice for one failure merely because two screenshots show it.
Different requirements can fail together, but name each failed requirement.

### `drawer`: 15 points

**Opening and access, 3 points**

1. The initial narrow-screen page provides a discoverable, reachable control for
   the session list, while the closed list does not consume a persistent desktop
   column or cover the conversation.
2. Activating the control reveals a legible session surface with the three
   supplied sessions and the current selection identifiable.
3. The surface fits the viewport and allows any overflowing navigation content
   to be reached by scrolling; controls are not cut off.

**Dismissal, 3 points**

4. An explicit close control returns to the conversation.
5. Tapping the backdrop dismisses the overlay without also activating the
   conversation behind it.
6. Repeated open/close cycles leave no invisible pointer-blocking layer, duplicate
   surface, or permanently locked conversation scrolling.

**Selection, 3 points**

7. After initial history settles, selecting session B opens its corresponding
   history and identifies B as current.
8. Selecting a session dismisses the mobile navigation and restores access to the
   conversation and composer.
9. Reopening the navigation reflects the current selection; selecting session C
   and returning to B works through ordinary, settled navigation.

**Search and existing controls, 3 points**

10. Searching for a supplied session filters the visible choices correctly.
11. Clearing search restores all supplied sessions, and a no-match query has an
    understandable empty result rather than a broken layout.
12. Existing pin/unpin functionality remains reachable and usable through the
    mobile navigation without accidentally selecting a different conversation.

**Viewport and state transitions, 3 points**

13. While the overlay is open, scrolling it does not unexpectedly scroll or
    interact with the obscured conversation.
14. An unsent composer draft survives opening and closing the navigation without
    changing sessions; no cross-session draft persistence is required.
15. Resizing between narrow and desktop modes leaves a usable appropriate layout,
    without a stale backdrop, hidden desktop session list, or orphaned drawer.

### `visual`: 10 points

Review the default mobile view, a scrolled history view, an expanded tool detail,
and the open drawer against the supplied references. Content naturally differs.

**Hierarchy, 4 points**

1. A compact navigation/header area clearly identifies the active conversation
   and gives access to session navigation.
2. User and assistant messages remain visually distinguishable with readable
   authorship/content hierarchy; neither role's content is hidden to achieve fit.
3. The conversation is the primary narrow-screen content area, with reasonable
   readable spacing rather than a scaled-down desktop canvas.
4. The composer remains visually separate and reachable, with the final message
   scrollable into view above it rather than permanently covered.

**Detail readability, 3 points**

5. Opening and closing the existing tool detail exposes its actual result, keeps
   the disclosure control reachable, and does not break message-column width.
6. Long code remains readable by local horizontal scrolling or another fully
   readable presentation; long URLs and filename text remain obtainable without
   widening the viewport or simply discarding their ends.
7. Expanding content, editing multiline input, and scrolling history do not cause
   overlapping text, detached actions, or cut-off composer controls.

**Reference alignment, 3 points**

8. The closed mobile view reflects the reference's single-conversation structure,
   rather than permanently allocating the desktop session column.
9. The open mobile navigation reflects the reference's left-hand overlay and
   backdrop relationship, with a visually distinct selected session.
10. Typography, message grouping, borders, and spacing form a consistent readable
    interface across the declared widths; no exact font, hue, radius, pixel
    distance, or animation is required.

Do not reward or punish personal taste. For a zero, identify the concrete
readability, consistency, or reference-hierarchy failure in evidence.

### `accessibility`: 5 points

1. New open/close/navigation controls have meaningful accessible names and exposed
   button/link semantics; the active session is programmatically distinguishable.
2. Opening and closing the drawer works by keyboard, including Escape dismissal,
   without pointer-only or hover-only dependencies for the new interaction.
3. Focus moves into the opened modal navigation and returns to its trigger on
   dismissal; hidden navigation controls are not left in the normal tab order.
4. While the modal navigation is open, keyboard focus does not escape into its
   obscured background, and the modal/navigation surface has a meaningful label.
5. New mobile controls have visible focus indication and adequate spacing to be
   individually activated, with readable labels and no color-only status cue.

These points apply to the new mobile navigation and changed controls. They do not
require unrelated accessibility remediation throughout every upstream component.

### `real_device`: 5 points

Use a real iPhone/Safari if available because the supplied reference targets an
iPhone. Record model, OS/browser version, and orientation. A different real mobile
device is acceptable if recorded consistently for all candidates; do not claim
it establishes iOS-specific behavior. If no real device is available, leave this
item pending and explain the limit. Browser emulation alone cannot earn it.

1. With the software keyboard shown, the input and send action remain visible and
   operable; entering and sending a message succeeds.
2. Dismissing the keyboard and browser toolbar expansion/collapse do not leave a
   large blank region, a covered composer, or an unusable conversation height.
3. Device safe areas are respected where present: text/actions do not collide
   with a notch or home gesture area in either tested orientation.
4. Portrait/landscape transitions and opening/closing the drawer preserve usable
   content and controls without requiring a reload.
5. Touch scroll of the message list, any overflowing code, and the drawer works
   without accidental page-wide horizontal movement or trapping the user.

## Boundaries and anti-overclaim checks

- A send test expects a locally appended user message and cleared input. The
  upstream app does not generate an assistant response to newly sent messages.
- The baseline history contains a long filename as Markdown text, not a real
  attachment card. Passing `long_content` does not establish file-card, image,
  upload, or download support. Preserve existing components, but do not require
  configuring a new upload service or backend.
- New-session creation is a baseline no-op. Do not require a backend, persistence,
  new-session implementation, or network access to pass this adaptation task.
- Race prevention, subscription cleanup, stream deduplication, and preserving
  reading position during incoming chunks are known baseline diagnostics. Do not
  score their repair unless a separately versioned task explicitly requests it.
- The design export is illustrative. Its static controls are not evidence that
  the implemented app's controls work. Inspect the running candidate.
- The runner must resolve and build the supplied candidate path, not an adjacent
  baseline or the grader's own directory. Keep grader dependencies, tests,
  reports, and server ownership independent of candidate files. Use a fresh
  grader-controlled port; fail on collision rather than grading another server.
- Pin the baseline commit, dependency lockfiles, and browser/tool versions. Block
  unnecessary external requests during browser grading. Reset local storage and
  isolate scenarios. If fixtures or runtime metadata are altered, preserve the
  evidence and report an integrity concern instead of trusting a forged success
  flag. Isolation is not a sandbox: run untrusted candidates in an appropriate
  restricted environment.
