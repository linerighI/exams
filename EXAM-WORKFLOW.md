# Reviewed banks and individual exam forms

1. Upload the textbook or import the full question bank in **الكتب وبنك الأسئلة**. Generated/imported questions remain drafts. Review the wording, four distinct options, correct answer, source, difficulty, topic and required diagrams before approval.
2. Create an exam and choose its approved bank. **تحديد المجموعة المعتمدة للسحب العشوائي** selects the full eligible pool (up to 500 questions); add it to the exam. New bank-based exams enable random delivery by default when the pool contains at least two questions.
3. In exam settings, set the number to draw for each topic/difficulty combination. Their sum is the student's question count (maximum 100). Unselected groups contribute zero. Both calculator and GeoGebra are disabled unless explicitly enabled for that exam.
4. Review the complete pool and confirm publication. The server checks for duplicate questions, insufficient group sizes, unapproved/stale bank items and enough distinct forms for the currently enrolled class.
5. At first start the server draws a cryptographically random combination rank and stores the selected questions, their order and answer key with the attempt. Ranks already assigned to other current attempts are skipped. Reconnects and restarts return that exact saved form. Grading, late-answer review and expiry use its answer key, not the full pool. Student responses contain neither correct answers nor the pool.

“Different” means different complete question sets. Some individual questions can overlap between students; every form has the same topic/difficulty counts, question count and total marks. This does not establish psychometric equivalence; the teacher's topic/difficulty classifications and review determine educational suitability. Adding students after publication can exhaust the distinct combinations. The app refuses to reuse a form; expand the pool and publish a new exam version. Editing an exam with existing attempts creates a separate version. Archived retakes remain available in backups; the uniqueness rule applies to current attempts.

Old fixed-form exams remain fixed. Teachers can explicitly choose fixed delivery for a new exam. AI is never called while assigning or grading an exam.

# Providers and math tools

The upper-left assistant selector switches between local Ollama, OpenAI (ChatGPT API) and Gemini. Configure each provider's model and key under **الإعدادات → الذكاء الاصطناعي**. The choice applies to conversations, prompt rewriting, book analysis, question generation and graph proposals. Direct bank/search commands continue to work without an AI model. Ollama needs a vision-capable model for page-image analysis. Cloud requests require internet and the relevant API key; live cloud calls have not been verified without those keys.

OpenAI uses the [Responses API structured-output format](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=responses), with server-side JSON validation and response storage disabled. The configurable default is [GPT-4.1 mini](https://developers.openai.com/api/docs/models/gpt-4.1-mini). API keys are protected by Windows DPAPI in the desktop app, isolated by teacher and excluded from settings responses and backups.

Opening **رسم لهذا السؤال · GeoGebra** analyzes the selected question using the chosen provider. A bounded construction schema accepts points, lines, segments, angles, circles, labels and polynomial graphs up to degree six. The app never executes model-supplied JavaScript. Missing/unsuitable graph specifications are rejected. The teacher reviews and attaches the result; it is never automatically approved.

Enabled student math tools run locally, including the bundled GeoGebra graphing interface. The scientific calculator uses the MIT-licensed [simoncragg/scientific-calculator](https://github.com/simoncragg/scientific-calculator) engine at commit `0ae021d5fb846e3ea9bcce253a3108df04339d0e`, adapted for MathJS 15 and loaded only when opened. Its themed interface supports degree/radian/gradian modes, fractions, powers, roots, logarithms and trigonometry. This is a community Casio-inspired calculator, not an official CASIO product. Source provenance and modifications are recorded in `src/vendor/scientific-calculator/UPSTREAM.md`; bundled license notices are in `public/licenses`. These controls govern tools inside the app, not other programs on the student's Windows account. Scratch work is auxiliary; the submitted multiple-choice answer remains the recorded response.

# Verification

The teacher **الأدوات** tab adds offline writing, calculation, drawing, conversion, statistics and planning tools alongside an online reference library. Student home, exam lists and results now share the exam workspace's visual style. See [TEACHER-TOOLS.md](TEACHER-TOOLS.md) for the complete behavior and validation command.

`npm test` covers balanced simultaneous assignments, exhaustive small pools, quota errors, answer-key privacy, restart recovery, grading from the frozen form, rejected unassigned answers, scientific calculator operations, protected student logout, safe graph specifications and mocked provider requests/errors/key exclusion.

`npm run test:desktop:school` exercises the approved-bank → random exam → student math-tools workflow in WebView2 and saves layout screenshots. `npm run test:ui` covers the broader existing browser workflow, including offline answers and teacher isolation.

# Student sessions and the submission orb

The student's orb is a fixed status indicator below the exam timer. Blue means answering, red identifies unanswered questions at final review or connection/storage problems, and green means all questions have selected answers. A separate submission button retains incomplete-answer checks and confirmation. Student chat/help is removed throughout the app. See [STUDENT-COMPANION.md](STUDENT-COMPANION.md).

Student sessions restore after reload and app restart. Logging out requires the owning teacher's password, checked by the teacher server with failed-attempt rate limiting. A teacher connection is required for this exit; password hashes are not stored on student devices. Logout does not submit an unfinished exam. The desktop shell enters full-screen mode and intercepts common escape shortcuts while it is foreground. These app restrictions cannot provide complete Windows lockdown. See [STUDENT-LOCKDOWN.md](STUDENT-LOCKDOWN.md) for the exact behavior and managed Windows requirements.

`npm run test:desktop:student-lock` checks denied bridge escapes, password validation and recovery across a full native/backend restart. Automated tests deliberately do not activate the global keyboard hook or full-screen enforcement on the developer desktop.
