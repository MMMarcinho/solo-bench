# Upstream findings and grading limits

These are source-inspected properties of the frozen upstream commit
`609b54a171d6536357810ec9baf1d0785c30fff1`. They are not candidate failures and not
extra scored requirements. Reference paths below are relative to the application
baseline. Preserve the baseline faithfully; keep any test fixtures or diagnostic
patches separate and disclose them.

## 1. History request race and loading state

`src/eval/useConversationRuntime.ts` starts `queryConversation(conversationId)`
on every selection, but does not cancel the old query or reject stale results.
Its `then` writes directly to shared message state and its `finally` clears
loading without checking which query completed.

`src/eval/mockConversation.ts` intentionally delays conversation A by 1400 ms,
B by 90 ms, and C by 180 ms. Selecting B before initial A resolves can therefore
show A history under the selected B conversation. Stale completion can also clear
loading for a newer request.

**Grading rule:** Wait for initial history to settle before ordinary scored
navigation. If running a rapid-switch diagnostic, label it non-scoring and record
both the selected conversation and actual visible history, after the old query
has had time to resolve. Do not require fixing the race to earn mobile points.

## 2. Subscription cleanup is absent

The same runtime calls `subscribeConversation(...)` but does not return its
unsubscribe function from the effect. Listener counts can grow on switches and
old listeners can append chunks to the wrong current conversation.

`src/main.tsx` enables React StrictMode. Development effect replay means
`createdSubscriptions > 1` is not itself evidence of a leak; the useful diagnostic
is the number of concurrently active subscriptions and actual duplicate or
wrong-conversation content. The upstream mock exposes
`window.__CODE_AGENT_EVAL__` with `activeSubscriptions`, `createdSubscriptions`,
`selectedConversationId`, and `emitStream`.

**Grading rule:** Keep subscription/stream-isolation repair non-scoring. A metric
is a diagnostic aid, not an oracle sufficient to establish rendered behavior.
Do not assert that the cumulative creation count must always be one.

## 3. Incoming messages force scroll to bottom

`src/App.tsx` runs `messageListRef.current?.scrollToBottom()` in a layout effect
whenever `messages` changes. This can override the more nuanced user-intent logic
in `src/ui/chat-ui/hooks/useAutoScrollToBottom.ts`.

**Grading rule:** Do not penalize an unchanged baseline forced-scroll behavior
during streamed updates. Mobile adaptation still requires ordinary history to be
scrollable and the composer/final message to be reachable. If separately
diagnosing follow behavior, test both following while already at bottom and
remaining with history after actual wheel/touch input. Record anchor position
and content arrival; merely assigning `scrollTop` does not reproduce all user
intent events handled by the upstream hook.

## 4. Sending does not invoke an assistant or backend

`src/App.tsx` trims submitted text, appends a local user `IMessageItem`, and clears
the composer. It does not call a model, persist the new message, or automatically
produce an assistant answer. Mock streaming is a separate explicit mechanism.

**Grading rule:** A normal send passes on one visible user message containing the
submitted marker plus a cleared composer. Do not wait for an AI answer. Do not
require sent messages to survive reload or switching away and back, because the
baseline re-queries fixed in-memory history. Avoid identical timestamp-sensitive
multi-send expectations unless the scenario explicitly accounts for them.

## 5. New-session action is a no-op

`src/App.tsx` supplies `onCreate={() => undefined}` to `SessionList`.

**Grading rule:** Preserve the existing control/layout if retained in the design,
but do not award or deduct functionality points for creating new sessions. This
task does not include implementing session creation or persistence.

## 6. No real attachment card in the seeded history

The last assistant reply in `src/eval/mockConversation.ts` includes a Markdown
inline-code filename after the text `附件：`. It is not a typed attachment message
and does not exercise `FileCard`. The design export shows a separate attachment
card with file type and size, which is illustrative content absent from the
seeded runtime history.

The application supplies no `uploadProps` to `ChatSender`; the attachment
provider's upload path returns without starting a service upload when neither
`onUpload` nor `action` is configured. The application send handler also ignores
the sender's file-list options.

**Grading rule:** Label automated coverage precisely as long URL, code, and
filename-text containment. Do not call it upload or attachment-card verification.
Do not require adding a backend or upload configuration. If a future benchmark
version adds a genuine offline attachment fixture, identify the fixture and its
injection route explicitly and apply it equally to all candidates.

## 7. Static reference content differs from the live app

`attachment/iphone-16-pro-chat.html` is a static 402 × 874 design export. Its
illustrative titles, messages, status labels, device chrome, and controls differ
from the seeded runtime app. Its checkbox/label drawer is not proof of complete
keyboard or production navigation behavior.

**Grading rule:** Compare the single-conversation hierarchy, left overlay drawer,
readability, contained long content, and composer placement. Do not require
replacing the app with the export, copying its illustrative data, or drawing an
iPhone frame inside the website. Award accessibility points for actual candidate
behavior, not literal copying of the reference markup.

## 8. Geometry and test-isolation pitfalls

The baseline viewport and multiple parent containers use `overflow: hidden`, and
the session panel is a fixed 300 px desktop column. A test of document-level
`scrollWidth <= clientWidth` alone can pass while most of a narrow conversation
is squeezed or clipped. Likewise, DOM text presence alone cannot prove it is
readable or that the composer is clickable.

**Grading rule:** Check element bounds, clipping ancestors, effective visibility,
hit targets, and the actual send action at each declared width. Local horizontal
scrolling of code is allowed; page-wide horizontal scrolling and hidden message
ends are not. Distinguish browser viewport resize from a real software keyboard.

Pinning is persisted in browser local storage (`src/hooks/usePinnedSessions.ts`).
Reset browser contexts/storage between independent scenarios so a previous
candidate or manual session cannot influence ordering or results. Timestamp-based
message/stream IDs and localized time rendering should not be exact snapshot
oracles; use unique submitted text and semantic state instead.

## 9. Clean-install TypeScript failure in Vite configuration

With the pinned upstream lockfile and documented clean install, `@types/node` is
not present. TypeScript reports exactly:

```text
vite.config.ts(1,18): error TS2307: Cannot find module 'node:path' or its corresponding type declarations.
vite.config.ts(9,25): error TS2304: Cannot find name '__dirname'.
```

Because `npm run build` chains TypeScript before Vite, that original command exits
nonzero at the typecheck step. The application can still run in development and
Vite can build it when invoked independently. This is an upstream environment/
typing issue, not a mobile implementation failure.

**Grading rule:** Preserve the source and allow only the exact two known
diagnostics above, or accept a fully clean typecheck. Require Vite's independent
production build to genuinely succeed; reject additional compiler diagnostics.
The result must show the original typecheck status and accepted diagnostic
exception instead of claiming the compiler passed. Do not award bonus points for
repairing Node typings or require that repair as a surprise mobile requirement.
If a future benchmark version normalizes the dependency setup instead, document
and apply that setup identically before every candidate; never silently alter
the pristine application fixture.

## Diagnostic reporting template

For each optional diagnostic, record:

- Candidate and upstream revisions; whether upstream was reproduced.
- Scenario, browser, viewport, and actual user/input events.
- Expected task behavior, observed behavior, and screenshot/log evidence.
- Classification: `pre_existing`, `candidate_regression`, `fixed_by_candidate`,
  or `unverified`.
- Score effect: `none` for unchanged known issues and optional repairs. Any
  scored regression must cite an explicit public task requirement and rubric ID.

Do not silently inflate the score for voluntarily fixing an unrelated bug, or
reduce it for leaving that bug intact. Candidate changes that independently break
ordinary desktop/mobile flows can still fail the corresponding scored check;
show evidence separating that regression from the known upstream issue.
