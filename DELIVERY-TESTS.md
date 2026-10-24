# Exam delivery verification

- Modes: identical questions and order; identical questions with a saved shuffled order; balanced random draw with an explicit teacher-selected question count.
- Pools support up to 1,000 questions. Each student answers at most 100. Defaults no longer halve the pool; a new random pool defaults to 30 (or the available count when smaller). Existing saved exam counts remain unchanged.
- Repeated sets across students are allowed. The allocator prefers unused combinations while available, then reuses combinations rather than refusing student entry. Each student's selection and order remain frozen in their attempt.
- Regression: 35 concurrent starts in each of five configurations (175 attempts): 550 to 30, 30 to 25, fixed 30, shuffled 30, and a shared one-question pool. Verified exact counts, hidden answer keys, retries, saved answers, restart recovery, image persistence, and full-mark grading.
- Full suite: 138 passed, 0 failed. TypeScript and Vite production build passed.
- Existing real HTTP/WebSocket load test: 30 students, 12 rounds, simultaneous camera uploads, 360 answer-save requests and 30 submissions. All scores correct and persisted data verified after server restart. This is loopback traffic, not a school Wi-Fi benchmark. Raw output: test-results/network-load-latest.json.
- UI checked: count 25 produces quotas 13+12; mode switching; reference-image opening/closing animation; 125% zoom, drag pan, keyboard reset, Escape, and return of focus to the thumbnail. Reference images use PNG/JPEG/WebP, up to 2 MiB; image viewer zoom is 100–400% and stays inside the exam window.
