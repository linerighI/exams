# Alshereqi Exams 1.6.0 Preview

This release includes the current local application updates since 1.5.5.

## Classroom connections and monitoring
- Search for the teacher through connected Ethernet, Wi-Fi and hotspot adapters together. Changing search priority preserves a working connection; recovery to another address verifies the saved teacher certificate.
- Open the login-page connection ball to see network addresses, search preferences, the hosting computer's pairing code and a short animated setup guide.
- Combine the live-room notice with the draggable assistant ball. Monitoring opens and minimizes from the same control. A subtle blue border glow marks active exams and fades while monitoring is open.
- Proctors can display or remove a blocking integrity warning for a student's current attempt. The exam timer continues; server-side answer and submission guards enforce the lock.

## Exams and mathematics
- Explicit question counts, random pool sampling, shuffled fixed questions and clearer distribution controls. Questions may overlap between students; assignments and grading remain tied to each saved attempt.
- Whole-exam reference images with a zoomable viewer, stronger book-based math prompts, individual SVG diagrams and combined diagram-atlas import/export.
- Clearer bank and exam validation, service information for Zunis, Animato and LANED, and updated teacher/student motion and appearance.

## Startup and onboarding
- Compact first-launch role selection and short, skippable account introductions.
- A new black Zunis app-start animation uses Remotion artwork and GSAP transitions. The Windows loader displays the same artwork during backend startup and resumes the sequence in the app instead of replaying it.
- The app-start update preserves the separate exam-start Zunis sequence.

## Installing and updating
Use the small online installer to download the verified full package from this release, or use the full offline installer. SHA-256 files accompany both installers. The existing app data directory is retained by an ordinary update. Close active classroom exams before installing. Enable preview releases in the updater to detect this preview.

Ethernet, Wi-Fi and hotspot devices must be able to reach the teacher's computer. On trusted school networks, the Windows Private profile allows the installer's existing local-subnet rules; guest/client isolation can still block traffic. Real classroom Wi-Fi/hotspot behavior requires testing on separate computers.

## Validation
146 automated tests pass, including question allocation, persistence, proctor locks, adapter discovery, verified address recovery, imports, backup and updater checks. Browser regressions cover startup, exam saving/reconnection, network settings and the combined room control. Native startup and desktop connection checks pass. The 30-student local HTTPS/WebSocket stress test includes simultaneous camera uploads, 360 answer saves, submission and server restart verification; all scores were correct. This simulated load does not measure a school's wireless network.
