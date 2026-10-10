# Setup

Use Node 20 or newer, npm and a local Chromium-compatible browser. The repository is a standalone frontend; no `.env`, model key, backend, remote service or login is needed.

This case uses desktop visual revision `01-chatbot-local-design-avatar-v2`, derived from the cited upstream source. `case.json` and `source.sha256.json` identify this revision; the upstream Git commit identifies only the original version, not these edited source files.

From the benchmark root:

```bash
python3 tools/verify-source.py
python3 tools/create-candidate.py /tmp/chatbot-candidate
cd /tmp/chatbot-candidate
npm ci --ignore-scripts --legacy-peer-deps --cache /tmp/solo-bench-npm-cache
npm run dev
```

Open http://127.0.0.1:4173/. The initial conversation deliberately takes about 1.4 seconds to load. The other histories load faster. `npm run build` attempts TypeScript checking and then a Vite production build. **Known clean-install limitation:** upstream omits `@types/node`, producing TS2307 for `node:path` and TS2304 for `__dirname` in `vite.config.ts`. The evaluator permits only those two exact existing diagnostics and runs Vite build separately. It never labels the raw TypeScript stage passed when this waiver applies. Candidates may add the missing devDependency; repairing this unrelated setup issue is not required. Any other type error fails.

The original source package has no additional test/lint command. Do not claim lint or a test suite passed unless you add and run one. Existing mock histories include long text, a long URL, a code block and expandable tool output. The displayed attachment filename is text, not a real uploaded file.

One legacy optional icon-font loader refers to a public CDN. The evaluator replaces that exact request with empty JavaScript and blocks other non-loopback browser requests; this leaves the source unchanged and avoids executing remote scripts. Do not rely on CDN access for grading. Icons rendered through this optional font may be absent; this known harness limitation is not itself scored as a candidate regression.

The baseline’s mock uses fixed history and fixed event delays; stream IDs and new-message times use the current clock. The evaluator fixes browser wall-clock date and does not use exact-pixel screenshot matching.
