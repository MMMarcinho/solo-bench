# Agent adapter

This adapter validates a real reviewer response against the shared envelope, candidate identity, and evidence hashes. It does not invoke or impersonate a judge. The unified launcher writes `agent-request.json` and `evidence-manifest.json`, and accepts an explicit `--agent-command` or `--agent-result`. Without either, all 35 agent points remain `pending` with JSON `null` scores.
