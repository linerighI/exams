# 1.4.1 — Local assistant latency

- Chat, status and prompt editing now respect fast mode: prefer installed qwen3:1.7b. Manual mode preserves the selected model.
- Chat uses a 4096-token context instead of 8192, four recent messages, compact resource summaries and shorter responses. Tool validation, private teacher data and publication review remain enforced.
- Requests keep the model resident for 30 minutes to avoid repeated loads during a teaching session. This intentionally retains model RAM while idle; it is not a CPU generation task.
- Unambiguous greetings and read-only navigation requests use the existing application tools directly. Other natural-language requests still use Ollama.
- Teacher-only response metadata reports model loading and generation timing, without message contents.

Verification on the installed qwen3:1.7b: bank-list shortcut 0.004 seconds; two short warm AI replies 4.171 and 4.657 seconds, model loading approximately 0.006 seconds each. Cold start and long prompt rewriting were not benchmarked; these are not maximum latency guarantees. Ollama timing and keep-alive behavior follow its official API: https://github.com/ollama/ollama/blob/main/docs/api.md

Backend suite: 41 tests passed. New cases cover fast/manual model selection, conservative read-only routing and rejection of ambiguous or mutating shortcut requests.
