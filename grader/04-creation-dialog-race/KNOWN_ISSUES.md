# Scope and validation limits

The starter intentionally permits obsolete template GET responses to update current state. It is not a reference solution. Mobile layout, redesign, and POST failure/cancellation races are out of scope.

The shared runner skips an agent stage when no agent criteria exist. This case needs no judge or agent configuration. Agent-only mode leaves all code checks unrun.

Browser/server permission errors are infrastructure blocks, not candidate zeroes. A missing required candidate server entrypoint is a candidate failure. Unit/protocol checks do not establish browser correctness; consult the repository validation summary for executed controls and environment limitations.
