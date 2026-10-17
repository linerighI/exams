# Student exam indicator

Students have no chat, helper conversation, floating companion, help input, or helper panel on their regular pages or inside exams.

During an exam, the orb stays in the navigation column directly below the timer. It is a noninteractive status indicator: blue while answering, red for unanswered questions at final review or connection/storage problems, and green when all questions have answers. Green does not mean answers are correct. The separate **مراجعة وتسليم** button keeps the existing incomplete-answer guard and final confirmation. The question map, persisted review flags, saving status, permitted calculator and GeoGebra remain available.

The teacher's live-camera request uses its own visible permission prompt and broadcast banner, independent of the status orb. See [LIVE-LAB.md](LIVE-LAB.md).

`npm run test:desktop:companion` now validates absence of student chat/help, indicator position beneath the timer, blue/red/green states, review recovery, permitted tools, confirmation and submission at 760/1366/1920 widths. Captures are in `test-results/student-indicator-*.png`.
