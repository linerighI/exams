# Teacher comfort and camera fixes

These changes are in the local source and development Windows build. The published installer has not been replaced.

- **Camera:** students choose to check the camera before starting an exam. The preview is local; it does not send video to the teacher. The Windows app asks for permission instead of silently granting it. A denial can be retried. Error messages distinguish Windows privacy restrictions, a missing camera and a device used by another app. Live monitoring still requires the student's consent and stops when monitoring closes or the attempt ends.
- **PDF preview:** the desktop bridge now accepts the bank document's specific query options. It continues to reject query strings on other API routes. This fixes the reported `طلب غير مسموح` error.
- **Teacher introduction:** the first login offers a short Arabic walkthrough using bundled [Driver.js](https://github.com/nilbuild/driver.js). Teachers can skip it or reopen it using **دليل البداية** in the top bar. Completion is saved to the teacher's database, with a local fallback scoped by school and account. New preferences default to the existing simple exam mode; previous explicit mode choices remain respected.
- **Navigation:** teacher navigation icons now have visible labels. Focus states, control transitions, walkthrough styling and narrow layouts have been refined. Reduced-motion preferences are respected.
- **Student codes:** new students receive unique six-digit codes across teacher databases. Existing codes remain valid. **رمز جديد سهل** replaces an existing code explicitly; the student must be logged out and have no active attempt. National-number accounts also retain an alternative code. Arabic digits, spaces and separators are accepted when signing in.
- **Excel:** student lists, marks and the import template now download as real `.xlsx` workbooks, with Arabic headings, filters, frozen headers and text formatting for identifiers/codes. Existing CSV imports remain compatible. Exports require a teacher account and remain within that teacher's data permissions.
- **Exam opening:** the student sees a black Zunis integrity reminder for three seconds. It warns that cheating may lead to cancellation and school disciplinary measures, without claiming to detect every form of cheating. The attempt is started after the reminder, so it does not consume exam time. Resuming a cached attempt does not repeat it.

Verification commands:

```powershell
npm test
node tests/comfort-ui.cjs
node tests/camera-permission-native.cjs
node tests/live-lab-native.cjs
node tests/pdf-native.cjs
```

The native camera checks use WebView2's synthetic camera. They test actual permission callbacks, denial/retry, preview, live upload and automatic stopping. They do not prove that a particular physical camera or its Windows driver works; the new diagnostics help identify those remaining device-specific issues.
