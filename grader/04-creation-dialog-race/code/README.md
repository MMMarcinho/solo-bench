# Deterministic creation-dialog grader

All 100 points belong to code checks. No agent/visual judge is required. The common runner supports `code` and `all` with the same complete score; `agent` leaves code checks unrun.

The adapter starts candidate `server.mjs` with `PORT=0`, reads its localhost URL, and uses a fresh Chromium context per criterion. It controls synthetic template GET response order and captures actual project POST requests. Source keywords and self-reported success do not determine scores.

| Criterion | Points | Observed sequences |
| --- | ---: | --- |
| manual_payload | 15 | Defaults; trimmed name, numeric seats and exact payload; success feedback and dismissal. |
| mode_isolation | 20 | Draft preservation; empty initial selection; in-flight mode switching, fresh refetch and stale completion while loading; current preview and exact payload. |
| template_race | 20 | Out-of-order successes, stale errors, active preview and submitted template. |
| dialog_lifecycle | 20 | Cancel/reopen defaults; same template requested by different dialog generations; Escape/reopen defaults. |
| error_recovery | 15 | Active error feedback; enabled retry, fresh GET, loading/ready and successful submission. |
| validation | 10 | Whitespace name; invalid/empty seats; absent/loading/failed template never submits; manual mode remains usable. |

Each criterion is all-or-nothing. Scored criteria reference saved JSON with captured requests/payloads, plus a screenshot when available. UI text and screenshots are supplemental; capture warnings do not replace structured evidence or change the score. If required structured evidence cannot be captured or saved, the criterion is blocked and has no score. Screenshots are not a visual-quality score. Locale, timezone and viewport are fixed. Synthetic titles distinguish responses from hardcoded fixture text. Aborting obsolete requests is accepted as well as ignoring their completion.

Run from the repository root:

```sh
node grader/run.mjs --case 04-creation-dialog-race --mode code --candidate /path/to/candidate --output /path/to/new-results
```

An optional `--chromium /path/to/browser` selects an installed browser. Missing Playwright/browser and platform-denied server permissions are `blocked/null`; missing required candidate entrypoint or reproducible behavioral failures are candidate failures. Candidate fingerprints must remain unchanged.

Not tested: visual polish, mobile layout, real-device behavior, live services, backend security, or POST failure/cancellation races. Browser route filtering is not a sandbox. Run candidates in a disposable, credential-free environment with OS-level network restrictions.
