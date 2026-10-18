# Settings, data and exam personalization

These features are included in the current local source and development build. They do not change an existing GitHub release or installed preview automatically.

## Settings

- **تحديث التطبيق** now lives in Settings. The existing background check still notifies teachers when a GitHub release is available. Downloads, progress and release notes stay inside the app; installation requires the explicit restart checkbox.
- **النسخ الاحتياطي** contains a whole-school Excel backup for the accounts administrator, plus the existing JSON backup for the signed-in teacher.
- **المحذوفات** lets a teacher restore deleted records or permanently remove them. Students, exams and banks have deletion controls beside their normal management controls. Advanced cleanup also lists unused source files and assets.

Deletion moves dependent records into the same recoverable trash entry. Deleting a student or exam includes its attempts and monitoring records. Deleting a bank preserves the question copies already saved in exams. Active attempts, signed-in students, running bank jobs and referenced assets prevent unsafe deletion. Permanent deletion asks for a separate confirmation.

## Complete database backup in Excel

The administrator's `.xlsx` includes readable sheets for students and login codes, results, banks, bank questions and exam metadata. It also embeds the original SQLite files for every teacher and the teacher-account registry, split into Excel-safe chunks with SHA-256 checksums. This preserves records and media that cannot fit naturally into ordinary spreadsheet columns, including audio, settings, trash and stored authentication data.

Keep this file private: it includes student access codes and account databases. Finish active exams before exporting. Installed program files, AI model downloads and browser caches are not database records and are not included. Some locally protected API secrets may need to be entered again on another Windows account.

To verify and extract the original databases into a **new** folder:

```powershell
node --import tsx scripts/extract-database-backup.ts "backup.xlsx" "new-output-folder"
```

The extractor validates checksums and allowed paths, and refuses to replace an existing folder. It does not hot-replace a running school's database. The existing Settings JSON restore remains a separate teacher-account workflow.

## Student exam appearance

Both the simple exam creator and the full exam editor include **مظهر امتحان الطالب**. Teachers can choose four ready-made palettes or custom accent/background colors, card style, normal/large question text and a short welcome message. A live preview shows the choice. Unreadable color combinations are rejected by both the editor and server.

Appearance belongs to the saved exam and is included in the student's offline snapshot. Editing an exam that already has attempts uses the existing exam-version behavior, preserving previous attempts.

## Exam audio

Teachers can attach instructions to the whole exam and recordings to individual exam questions. Upload MP3, WAV, OGG or WebM up to 2 MB per clip, or record using the microphone for up to two minutes. Playback is controlled by the student and never starts automatically. Unsupported codecs show a helpful error.

Audio is stored once as an authorized media record instead of repeating base64 in teacher exam lists. Starting/resuming an attempt includes its relevant clips in the offline snapshot. Students can retrieve only clips belonging to their own attempts. The native microphone permission remains teacher-only.

## Question quality and motion

The copied bank prompt and built-in generator share a stricter quality guide: source grounding, curriculum coverage, unique correct answers, plausible distractors, independent mathematical checks, units, meaningful figures, evidence and valid JSON. Teacher approval is still necessary; a stronger prompt is not a guarantee that AI output is correct.

The interface uses the existing open-source Motion library for shared-layout palette and Settings tab transitions, animated previews and trash-list changes. No additional animation runtime was added.

## Verification

- `node scripts/run-tests.cjs`: 92 tests passed, including tenant isolation, audio validation, deletion guards, recovery and complete database round-trip verification.
- `node --import tsx tests/personalization-ui.ts`: browser interaction checks for update consent, Excel backup action, custom colors, contrast, audio upload/record/playback, student appearance, deletion/restore and a 760 px layout.
- `node tests/personalization-native.cjs`: actual Windows WebView2 Excel save, synthetic microphone recording, student audio playback under the app CSP, and saved appearance.
- `node scripts/build-desktop.cjs`: TypeScript, production assets, backend bundle and native development build.

Microphone testing uses a synthetic device; physical microphone hardware and a full installed-release update were not exercised by these checks.
