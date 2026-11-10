# SchoolSync verification — 10 November 2026

Implemented and checked on Windows with Node 24.12.0, the repository's installed dependencies, SQLite, and Microsoft Edge in mobile emulation.

## Completed checks

- Strict TypeScript check and Vite production build: passed.
- Backend integration tests: **32 passed, 0 failed** across `tests/api.test.cjs` and `tests/setup.test.cjs`.
- Fresh operational SQLite database verified: `schoolsync/.data/schoolsync-live.sqlite` starts with 0 schools, 0 users, 0 students, 0 grades, and 0 attendance records.
- First-run config verification: `GET /api/config` returns `demo: false` and `setupRequired: true` on a fresh database.
- First-run Arabic setup flow (`POST /api/setup`): verified with an in-memory database; creates school and admin, starts session, prevents duplicate setup with HTTP 409, and rejects non-local/invalid requests.
- Mobile browser workflow script: passed with no page runtime errors.
- Fresh Arabic-first sign-in through the actual login form: passed.
- Arabic homework submission, saved state, and optional English switching: passed.
- Guardian sibling switching and authorized school messaging: passed.
- Teacher draft grade creation and subsequent publication through the UI: passed.
- Administrator account creation and weekly lesson creation through Arabic forms: passed.
- Light and dark themes, 390×844 and 320×740 RTL layouts: checked.
- Original blue orb reused directly; no orb on login and no floating orb over controls.
- Git whitespace check: passed.
- Updated family/staff role selection and national-ID/code login: passed in the mobile browser.
- Both independent sibling credentials resolve to the same verified family account: passed.
- GSAP student-card selection, sibling switching, separate grades/attendance tabs, and account-only profile: passed.
- Staff parent-view integration, teacher grade publication, administrator family credential provisioning, and subsequent login using those new credentials: passed.
- Family credentials reject revoked guardian links; staff portal rejects a family account; identity/code hashes are not exposed in dashboard data: passed.
- Running built application on port 4325: Arabic HTML, JavaScript asset delivery, cookie sign-in, authorized Arabic school records, and logout passed.

Backend checks cover first-run setup validation and atomic school provisioning, config state, authentication, logout, guardian/student relationships, cross-school isolation, teacher restrictions, real homework submissions/corrections, publication notifications, private draft grades, attendance windows and atomic submissions, unexpected-absence detection, duplicate incident suppression, staff resolution, notes, messages, notification read state, timetable conflicts, new-school configuration, account provisioning, student account linkage, password/session revocation, and authenticated live-update delivery. Demo fixtures are isolated strictly to in-memory automated tests and the `--demo` flag, never loaded into the normal running application.

The browser checks caught and led to fixes for inherited desktop CSS, mobile animation overflow, bottom-sheet touch coordinates, and a floating orb overlapping the message composer. Checks were rerun after those fixes.

## Reproduce

From the repository root:

```powershell
npm run schoolsync:build
npm run schoolsync:test
node schoolsync/tests/browser.cjs
```

The browser script uses its own in-memory school and ports 4321/5181. It needs local networking and permission to start the installed Edge browser. The npm-hosted Playwright CLI could not download in this environment; checks used the repository's already installed Playwright library with Edge. No extra testing dependency was installed.

Screenshots are in `output/playwright/schoolsync-*.png`, including Arabic login, home, schedule, administrator workspace, and the 320px layout.

## Not verified or not delivered

No real-device iOS/Android run, native package signing, app-store build, hosted deployment, push delivery, email/MFA, load benchmark, external penetration test, backup restore rehearsal, or legal/privacy review was performed. This report does not claim those features or verification. The exact remaining scope is in `README.md`.
