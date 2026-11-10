# SchoolSync

An Arabic-first, mobile-first student and school application built with the exams repository's React 19, Vite, TypeScript, Tajawal, Lucide, GSAP, Fastify, and SQLite stack. The original blue orb is imported directly from `src/BlueOrb.tsx`. Shared base CSS is imported in a cascade layer, with a separate mobile layout and the original blue surface language.

The exams application has not been replaced. SchoolSync lives entirely in this directory; the root package only gains SchoolSync commands. There are no exam or question-bank features in SchoolSync.

## Family and school experiences

The Arabic login now starts with two spaces: **ولي أمر** and **معلم أو إدارة**. Family accounts use a child's ten-digit national ID as the username and that child's independent access code. Both sibling credentials resolve to the same verified guardian account. An animated student-card chooser then opens the selected child's day. This is one family account with authorized child profiles, not duplicated guardian logins.

The school space uses staff email/password credentials and server-resolved teacher/admin permissions. Staff can inspect the same family dashboard for authorized students using the student picker, while retaining staff-only classroom tools. Grades and attendance have separate primary navigation tabs in both spaces; they no longer appear inside the profile. Homework is available directly from the day's dashboard. The profile contains account settings.

The role selection, screen transitions, tab marker, child-card deck, swipe feedback, chart drawing, sheets, and button feedback use GSAP. SchoolSync no longer imports the Motion library. The original exams orb remains in the home pulse and its companion panel; it is not repeated across login or the student chooser.

## Open the app

From the repository root:

```powershell
npm run schoolsync:dev
```

Open **http://127.0.0.1:5180**. The normal running application uses an empty, real SQLite operational database (`schoolsync/.data/schoolsync-live.sqlite`), starting with zero schools, users, students, grades, or attendance. The interface is Arabic-first with native RTL layout; English is available as an optional preference.

### Arabic first-run setup flow

On a fresh database, `GET /api/config` returns `{ demo: false, setupRequired: true }`. The application immediately displays the polished Arabic first-run setup screen (**إعداد المدرسة لأول مرة**):
- **اسم المدرسة**: Official school name.
- **اسم مدير المدرسة**: Primary administrator full name.
- **البريد الإلكتروني للمدير**: Administrator login email.
- **كلمة مرور المدير**: Private administrator password (minimum 12 characters, with visibility toggle).
- **المنطقة الزمنية**: School time zone (defaults to `Asia/Amman`).
- **أوقات الدوام**: School day start and dismissal hours (defaults to `08:00` - `14:00`).

Submitting the form issues an atomic `POST /api/setup` (restricted to local connections `127.0.0.1` / `::1`), writes the school and administrator to `schoolsync-live.sqlite`, issues an authenticated session cookie, and opens the administrator workspace. There are zero pre-seeded students, grades, or attendance records.

### Isolated demo fixtures (Automated tests only)

Fictional demo data is **never** loaded into the normal application or operational database. Demonstration fixtures remain strictly for isolated automated test runs (`npm run schoolsync:test`) and the end-to-end browser check (`node schoolsync/tests/browser.cjs`).

For manual UI testing of populated schedules, the backend server can be run with the explicit `--demo` flag:
```powershell
node schoolsync/server/app.cjs --demo
```
This isolates fictional data to `schoolsync/.data/schoolsync.sqlite` without touching `schoolsync-live.sqlite`.

### Family access configuration (Operational)

Family accounts use a child's ten-digit national ID and that child's independent access code. Both sibling credentials resolve to the same verified guardian account. An animated student-card chooser then opens the selected child's day.

For a real school: create the guardian account, verify and link the guardian to each child, then open **إدارة الصف → دخول العائلة** as administrator. Supply the selected child's national ID and code. Reuse the **same guardian account** for siblings. The server refuses unverified links and duplicate national IDs assigned to different children. Updating credentials closes existing sessions for the affected family account. A family can change one selected child's code from its profile without changing sibling codes.

Set `SCHOOLSYNC_ID_PEPPER` to a unique random server-side secret before issuing operational family credentials. It is automatically generated and saved to `schoolsync/.data/schoolsync-live.sqlite.identity-key` if not set. National-ID lookup values use keyed HMAC-SHA256; codes use salted scrypt. Neither the raw national ID nor the code is stored in dashboard responses, browser preferences, or audit messages. Preserve this secret securely with backups; changing it requires reissuing credentials.

## Implemented workflows

- Arabic two-step family/staff login, optional English, persisted language/theme preferences, true RTL, light/dark themes, and a home-screen manifest.
- Role-aware student, guardian, teacher, and administrator experiences with authorization on the server.
- The School Day Pulse orb, actual school-timezone progress, daily and weekly schedules, lesson details, and accurate unrecorded attendance states.
- Database-backed homework, searching/filtering, actual written submissions and corrections, and authorized guardian/staff access to submitted work.
- A local focus timer with 15/25/45-minute sessions, pause, reset, and elapsed-time calculation. Timer sessions are intentionally not academic records and stop when the focus sheet closes.
- Academic charts from published grades, attendance history, student notes, and multiple linked children.
- Persisted messages between authorized school contacts, announcements, notifications, and read state.
- Teacher attendance, homework publication, notes, grade drafts and publication.
- Attendance discrepancies after earlier confirmed presence: one persisted incident per student/date, guardian notification, staff investigation/resolution, and event history. An unexplained absence is not represented as confirmed departure.
- Administrator enrollment, account creation, verified guardian links, new weekly lessons, teacher assignment, timetable edits with conflicts checked, school name/timezone/hours, announcements, and incident resolution.
- Account password changes verify the current password and revoke other sessions.
- Authenticated WebSocket invalidation followed by an authorized state fetch. An 8-second reconciliation loop, visibility refresh, and reconnect handling provide fallback synchronization. WebSocket broadcasts contain only a change signal, not student data.
- Reduced-motion support, scoped GSAP cleanup, animated tab selection, swipeable child cards, sheet entrance/exit, and visibility-paused orb animation.

## Independent school setup

Use a separate empty database. The standard server never creates default accounts automatically.

```powershell
$env:SCHOOLSYNC_DB = 'schoolsync/.data/my-school.sqlite'
$env:SCHOOLSYNC_SCHOOL_NAME = 'اسم المدرسة'
$env:SCHOOLSYNC_TIMEZONE = 'Asia/Amman'
$env:SCHOOLSYNC_ADMIN_NAME = 'اسم مدير المدرسة'
$env:SCHOOLSYNC_ADMIN_EMAIL = 'admin@your-school.example'
# Supply a unique password of at least 12 characters through your environment.
$env:SCHOOLSYNC_ADMIN_PASSWORD = '<your unique password>'
node schoolsync/server/manage.cjs init
Remove-Item Env:SCHOOLSYNC_ADMIN_PASSWORD
npm run schoolsync:build
npm run schoolsync:start
```

Open **http://127.0.0.1:4320**. The built frontend is served by Fastify on the same origin as its API. Initialization refuses to run if any accounts already exist. Do not run `--demo` against an operational database. The environment template is in `.env.example`; environment variables must be set in your shell or service manager, since the backend does not load dotenv files.

As administrator: configure the school hours; enroll a student; create a teacher with the matching class code; add lessons; create the student's account and a guardian account; verify and link the guardian. Teachers can then publish homework and record grades/attendance. This sequence also works on an empty school without seeded schedules.

For a hosted instance, run behind an HTTPS reverse proxy, preserve the request host and upgrade WebSocket connections on `/api/live`, and set `SCHOOLSYNC_SECURE_COOKIE=1`. Only change `SCHOOLSYNC_HOST` from `127.0.0.1` when you intentionally expose the service. Review the limitations below before handling real student information.

## Verification

```powershell
npm run schoolsync:build
npm run schoolsync:test
node schoolsync/tests/browser.cjs
```

The build includes strict TypeScript checking. Backend integration tests use isolated in-memory SQLite databases and a controlled clock for attendance windows. The browser script starts isolated demo/Vite servers on ports 4321/5181, uses the installed Microsoft Edge, and checks actual UI interactions. It does not modify the local development database.

The browser checks cover sign-in, reload persistence, homework submission, schedules, dark theme, RTL, guardian child switching, messaging, teacher tools, Arabic-first login and submission, the companion sheet, and 320px/390px mobile widths. Screenshots are generated in `output/playwright/`. See `VERIFICATION.md` for the completed run results.

## Database, sessions, and recovery

The initial schema is `server/schema.sql` and is applied idempotently on startup. It includes school ownership, users, guardian links, students, lessons, homework/submissions, grades, attendance/incidents/events, notes, messages, announcements, notifications, sessions, and audit records. Foreign keys, validation, unique submission/attendance/incident keys, database transactions, and indexes protect the implemented flows. Future schema changes should use explicit numbered migrations; this version is the initial schema.

Passwords use salted scrypt. Session tokens use cryptographic random bytes, are stored hashed, and expire after seven days. Cookies are HttpOnly/SameSite=Strict and optionally Secure. Mutation requests validate origins when supplied. Login attempts are throttled per process/IP. Sensitive operations validate school, role, assignment, or guardian linkage on the server. SQLite is accessed only by the server; browsers do not access the database directly. This is API-based authorization, not Supabase RLS.

Create an online-consistent backup with SQLite's backup API:

```powershell
node schoolsync/server/manage.cjs backup
```

Backups are written to `.data/backups/`. Secure and encrypt copies using your hosting/backup platform, define retention with the school, and test restores. To restore: stop the server, retain the current database and sidecars as a recovery copy, restore a selected complete backup to `SCHOOLSYNC_DB`, then restart and verify representative accounts. Do not copy only the main SQLite file while the server is running in WAL mode.

## Scope and remaining deployment work

This is a working local application and a foundation for further school deployment. It is **not a completed implementation of every item in the attached master brief** and is not a certified production service.

- Per the direct request to retain the exams framework, this is a mobile web application, not React Native/Expo. There are no generated Android APK/AAB or signed iOS packages. Android and iOS can open the responsive app in a browser or use their browser's home-screen action; native-store packaging requires additional work.
- The backend is the existing-stack Fastify/SQLite approach, not a hosted Supabase project. Cloud deployment, school credentials, TLS, monitoring, email infrastructure, and operational access controls are not provisioned.
- No background push delivery, email invitations/recovery, MFA, file uploads, CSV import, advanced exports, holidays/schedule exceptions, multi-school guardian accounts, or scheduled announcements are implemented.
- A teacher is assigned one section in this version. School-wide administration is supported; richer multi-section teaching assignments need an expanded model.
- Homework supports written text submissions. Grade history and attendance charts use recorded data; there is no invented attendance history or simulated success.
- Offline mode retains the currently loaded state in memory and reconciles after reconnect. It does not cache student records to persistent device storage, queue offline writes, or guarantee offline launch.
- Attendance can be recorded from that lesson's start until the configured school dismissal time, on the school's current date. Historical/backdated corrections need a separate authorized workflow. Changing attendance does not automatically resolve an incident; staff must verify and document resolution.
- There is no self-service deletion, archival, password-reset email, account deactivation, or full retention-policy UI. Deployment-region/privacy review and tested authorization review are still required before actual student use. No regulatory compliance is claimed.

## Source references consulted

- [Fastify validation](https://fastify.dev/docs/v5.8.x/Reference/Validation-and-Serialization/)
- [GSAP React context and cleanup](https://gsap.com/docs/v3/GSAP/gsap.context%28%29/)
- [Vite backend integration](https://vite.dev/guide/backend-integration.html)

The original vendored orb and its license/source notes remain in `../src/vendor/ai-orb/`. No additional paid services are required to review this deliverable.
