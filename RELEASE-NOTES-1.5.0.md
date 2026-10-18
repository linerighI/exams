# Alshereqi Exams 1.5.0 Preview

Windows x64 preview with the current local app improvements. Back up school data before updating, and finish active student exams before installation.

## Downloads

- **Online-Preview-Fast-Fix-Setup.exe**: small setup launcher; downloads and verifies the complete app from this GitHub release. The small launcher still requires the full app download.
- **WebView2-1.5.0-Setup.exe**: complete offline installer, including the existing offline tools.
- Matching `.sha256` files verify both installers.

## Teacher workflow

- Simple one-page exam creation, manual blank banks/exams, and first-login teacher guidance.
- Settings now contains application updates, full-school Excel database backup, and recoverable deletion.
- Delete unwanted students, banks and exams; restore them from trash. Active attempts and referenced data are protected.
- Export student lists and results as Excel, and school reports and question banks as formatted PDFs.
- Stronger AI question-generation instructions, including source evidence, mathematical verification, distractor quality and figure preferences.

## Exam experience

- Customize exam accent and background colors, card style, text size and welcome message with a live preview and contrast checks.
- Add whole-exam audio instructions or question audio; upload clips or record with a microphone.
- Improved camera permission handling and retry guidance.
- Easier student access codes and a short integrity reminder before an exam begins.
- Smoother Settings, palette selection and deletion-list transitions.

## Reliability

- Guard against starting another main PC while a main connection already exists.
- Student attempts retain exam appearance and audio for offline continuity.
- Full-school Excel backup preserves original SQLite databases and verifies their checksums. It includes private access data; store it securely. Installed app files, browser caches and AI model downloads are outside this database backup.
- Earlier 30-student network-load checks and current regression checks are documented in the repository.

## Update notes

This is a **preview release**. In app versions that include the new updater, open **Settings → تحديث التطبيق** and enable preview releases to find it. Older 1.4.3 installations without that updater need to run a downloaded installer once. Installation closes the app; it does not require deleting school data.

The automated microphone checks use a synthetic device. Test real microphones and the school's network before classroom use.
