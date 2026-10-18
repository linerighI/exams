# PDF exports and classroom performance

The source and development desktop build contain these changes. The published installer has not been rebuilt or replaced.

## Export school records

Open **Students → Export school data PDF**, or **Settings → Backup → Export school data PDF** (Arabic labels: **تصدير بيانات المدرسة PDF**).

Choose students, marks and attempts, exam settings, bank summaries, operation history and teacher accounts. Archived attempts are included by default. Optional answer details include the student's assigned random questions, choices, correct answers, explanations and diagrams. Preview before saving. In the Windows app, choose a local PDF filename; browser users choose Save as PDF from the print dialog.

Student login codes and exam entry codes are **off by default** and can be included explicitly. Teacher passwords and national identity numbers are stored as protected credentials and cannot be recovered. Password hashes, API keys and authentication tokens are never printed. Reports use the signed-in teacher's database and assigned-class permissions; administrators can also list teacher accounts. An administrator's academic report does not combine other teachers' separate databases.

The PDF is a readable academic report, not a restorable database backup. Original PDFs, surveillance images, AI conversations and internal settings remain in the existing JSON backup. Bank summaries link conceptually to the separate bank export: they do not repeat every bank question in the school report.

## Export a question bank

Open a bank → Files and settings → **تصدير بنك PDF محليًا**. Choose a document title, a topic or all topics, and approved-only filtering. Teacher copies include a separate answer key. Student copies always exclude drafts and answers, regardless of the approved-only control. Arabic text, mathematical notation and diagrams are embedded for offline A4 printing. The preview clears when export options change.

## Performance changes

- Student attempt polling and resuming select matching rows through indexed SQLite queries before reading embedded question images.
- Access checks reuse records within synchronous request work. This cache clears before asynchronous continuations and is isolated by teacher/request.
- Simultaneous student heartbeats no longer each scan the entire classroom. Full heartbeat cleanup runs at most once per second; frame permissions and teacher controls are still checked immediately.
- Immutable print fonts and KaTeX styles load once per server process instead of reading all font files on every export.

## Verification

Automated coverage checks teacher/student roles, tenant isolation, credential opt-in, archived random-question answers, safe HTML, math fonts, and separate student/teacher PDFs. UI checks cover previews, save options and 760px layouts. Three synthetic sample PDFs were rendered and inspected across 20 A4 pages, including page numbers and repeated table headers. A real WebView2 desktop test saved a school report and a student question paper through the native bridge.

The network benchmark uses 30 students, a random exam with 30 diagram questions (10 assigned per student), 12 synchronized answer rounds, 30 camera uploads per round, heartbeats, teacher polling and a teacher WebSocket. It verifies every final score, revision and answer, and checks recent camera frames and online devices. Its HTTPS mode opens a fresh TLS connection per request like the current desktop client.

Run:

```powershell
npm test
npm run test:pdf:ui
node tests/pdf-native.cjs
$env:LOAD_TLS='1'
$env:LOAD_LABEL='tls-final'
npm run benchmark:network
```

On this Intel Core i5-14400F PC, the measured HTTPS stress run completed all 30 students correctly; answer-save latency was about 0.9 seconds at the 95th percentile. Results are written under `test-results/network-load-*.json`. This is a short loopback server test, with clients and server on the same PC. It does not prove performance on 30 separate computers or a school's Wi-Fi. Before a classroom rollout, test a full exam on the actual teacher PC, access point and student machines; simultaneous cameras require substantially more network capacity than answers alone.
