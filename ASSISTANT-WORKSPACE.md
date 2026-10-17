# Assistant workspace knowledge and actions

Ollama, OpenAI and Gemini share the same curated app guide and backend tool contracts. This extends prompting and application capabilities; it does not retrain a model or grant arbitrary access to the computer.

## Knowledge and context

The guide covers the current library and bank folders, drag selection and bulk review, random balanced exam delivery, student workflow and offline recovery, merged monitoring/results, low-frame-rate camera monitoring, teacher tools, provider settings and backups. Relevant sections are retrieved for each message. App how-to questions use the verified guide directly, so a small model cannot invent camera recording or exam-closing behavior.

Explicit tool requests receive current teacher-owned bank metadata, bounded selected-bank questions and folder IDs, exam IDs/statuses and aggregate counts. Ordinary discussion excludes private bank records. Passwords, provider keys, login codes and camera frames are not supplied as tool context. Student names in chat are anonymized; short numeric IDs are not blindly replaced because they can be question counts.

The assistant now retains more bounded conversation history, uses an 8192-token local context and a larger response budget, and allows one schema-constrained repair of malformed model JSON. No action runs before successful parsing. Fast/manual model preference remains unchanged; the installed model's general reasoning limits remain.

## Functions

- `/دليل`: current app instructions and navigation.
- `/أدوات`: direct links to eight teacher tools. “افتح الحاسبة” and “افتح GeoGebra” work without generation.
- `/جاهزية`: actual approved/draft/missing-image counts. Natural explicit readiness requests use backend counts directly.
- `/مجلدات`: actual library and bank folders.
- `/مراقبة`: opens the live monitoring room.
- Existing search, bank selection, draft creation/editing, student lists, insights and prompt rewriting remain available.
- Reviewed proposals: create a colored bank folder; approve, return to draft, move or delete question groups; publish an exam, close its admission, or publish results.

Examples: “أنشئ مجلدًا باسم مراجعة داخل بنك الرياضيات، ولونه أخضر.” and “اعتمد جميع الأسئلة في بنك الرياضيات.” Explicit common requests have deterministic routing; less structured requests use constrained model schemas.

## Reviewed changes

Proposal cards show the target, operation, scope/count and up to five sample question texts when relevant. They do not change school data until the teacher presses **تطبيق الاقتراح**. Applying a proposal calls the existing authenticated backend endpoint; required images, exam publication rules, question ownership and tenant boundaries are still enforced.

Proposals are teacher-scoped and expire after 15 minutes. A fingerprint rejects changed bank/exam data, repeated application is idempotent, concurrent application is locked, and execution paths are allowlisted independently of stored proposal data. A maximum of 100 suggestions is retained per teacher. Closing admission leaves existing attempts running. The assistant cannot change grades, bypass student logout, start a camera silently, execute shell commands or install software.

## Verification

- `npm test`: includes current app knowledge, ordinary-chat isolation, schema repair, proposals, stale data, expiry, idempotency, path tampering, teacher/student isolation, reviewed exam publishing/closing/results and existing regression tests.
- `npm run test:desktop:assistant`: actual WebView2 proposal rendering, applying and persistence, readiness, calculator opening and live monitoring opening with isolated school data.
- `npm run test:assistant:local`: repeatable app tasks and an actual free-form generation against installed Ollama, without applying suggestions.

Real qwen3:1.7b evaluation exposed incorrect folder routing and invented camera behavior. These app-specific requests were moved to deterministic routes or verified guidance, and operation schemas were narrowed. A few passing prompts do not establish subject-wide academic accuracy; teacher review remains necessary for generated educational content.
