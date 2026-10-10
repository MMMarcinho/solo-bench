# Validation summary

This public summary omits local paths, raw logs, screenshots, and archived work. It records the checks completed before the first repository sync on 2026-10-10.

- `python3 tools/verify-source.py --case 01-chatbot`: 75/75 current source files matched the manifest, including both generated avatars. The Case 01 task remains unsolved in the starter.
- `python3 tools/verify-source.py --case '02-GPT6 介绍页滚动效果'`: 3/3 starter files matched the manifest.
- `node --test grader/shared/test/*.test.mjs`: 33 passed, 0 failed. These cover the shared result protocol, pending/null behavior, candidate fingerprint and Case 02 entry points.
- The Case 02 **reference demonstration**, served from the local project and sampled in headless Chrome at 1180×757 and 390×844, earned 65/65 on deterministic code checks. At the title's mid-drag position, a 10.5-second pause held the same pose and reverse scrolling retraced it. Screenshot pixels confirmed a rendered title pointer and line-based blue selection. Static-title, body-only, hidden-pointer, and delayed-timer negative controls failed their relevant checks. This is a check of the reference demonstration, not a score for the deliberately incomplete starter.

No agent visual judge was run, so its 35 points remain `pending` with `null` scores, and the final score remains `null`. No physical device, full-page comparison to the source site, or clean dependency installation was performed. Browser evidence used Node v24.21.0, Chrome 154.0.8037.98, and an app-bundled Playwright 1.57.0; the repository lock declares Playwright 1.62.1. An earlier Case 01 build relied on Node types outside an isolated checkout and must not be described as a clean-environment pass.
