# Deterministic creation-dialog grader

All 100 points belong to code checks. No agent/visual judge is required. The common runner supports `code` and `all` with the same complete score; `agent` leaves code checks unrun.

The adapter starts candidate `server.mjs` with `PORT=0`, reads its localhost URL, and uses a fresh Chromium context per criterion. It controls synthetic template GET response order and captures actual project POST requests. Source keywords and self-reported success do not determine scores.

| Criterion | Points | Observed sequences |
| --- | ---: | --- |
| manual_payload | 15 | Defaults; trimmed name, numeric seats and exact payload; success feedback and dismissal. |
| mode_isolation | 20 | Draft preservation; empty initial selection; in-flight mode switching, fresh refetch and stale completion while loading; current preview and exact payload. |
| template_race | 20 | Out-of-order successes, stale errors, active preview and submitted template. The first stale success has a bounded observation window before the next selection. |
| dialog_lifecycle | 20 | Cancel/reopen defaults; same template requested by different dialog generations; Escape/reopen defaults. |
| error_recovery | 15 | Active error feedback; enabled retry, fresh GET, loading/ready and successful submission. |
| validation | 10 | Whitespace name; invalid/empty seats; absent/loading/failed template never submits; manual mode remains usable. |

Each criterion is all-or-nothing. Evidence includes captured requests/payloads, UI text, screenshots and assertion reasons. Screenshots are not a visual-quality score. Locale, timezone and viewport are fixed. Synthetic titles distinguish responses from hardcoded fixture text. Aborting obsolete requests is accepted as well as ignoring their completion.

For the first out-of-order success, the grader observes preview and status mutations from before release through 350 ms after the response helper returns. It records the first unexpected state even if the UI later recovers. This checks a bounded interval, not every possible delay.

Run from the repository root:

```sh
node grader/run.mjs --case 04-creation-dialog-race --mode code --candidate /path/to/candidate --output /path/to/new-results
```

An optional `--chromium /path/to/browser` selects an installed browser. Missing Playwright/browser and platform-denied server permissions are `blocked/null`; missing required candidate entrypoint or reproducible behavioral failures are candidate failures. Candidate fingerprints must remain unchanged.

Not tested: visual polish, mobile layout, real-device behavior, live services, backend security, or POST failure/cancellation races. Browser route filtering is not a sandbox. Run candidates in a disposable, credential-free environment with OS-level network restrictions.
