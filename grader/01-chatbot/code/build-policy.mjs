/** Exact known upstream exception. Never widen to regexes that could hide new errors. */
export const baselineTypeErrors=[
 "vite.config.ts(1,18): error TS2307: Cannot find module 'node:path' or its corresponding type declarations.",
 "vite.config.ts(9,25): error TS2304: Cannot find name '__dirname'."
];
export function isKnownBaselineTypeFailure(exitCode,log){const lines=log.trim().split(/\r?\n/).filter(Boolean);return exitCode===2&&lines.length===2&&baselineTypeErrors.every(e=>lines.includes(e));}
