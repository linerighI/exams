# Alshereqi Exams 1.5.5 Preview

Student-PC updates over the school network, easier student imports, correct English text direction, and an animated update menu on the sign-in page.

## Update the classroom from the teacher's PC

- The update menu is available on the sign-in and initial school setup page. Its blue-and-white popup uses GSAP when opening and the Genie effect when closing, with keyboard support and reduced-motion preferences.
- In **Settings → App updates**, choose **تجهيز أحدث نسخة للطلاب**, download the verified Windows package, then choose **إرسال التحديث للطلاب**. The current release can also be prepared for older devices.
- Supporting, signed-in student PCs download the package from the paired teacher over the local school network, without requiring their own internet connection. The teacher can track device progress and stop the distribution.
- Downloads resume after interruption and are checked against the expected size and SHA-256. TLS certificate pinning verifies the paired teacher before student authorization is sent.
- Installation waits until the student's active exams are submitted or expire. A 20-second notice precedes installation; a server-side installation permit blocks a new exam from starting during that handoff. The app reopens afterward.
- Failed or declined installation attempts are reported to the teacher after restart instead of repeatedly relaunching Windows elevation prompts.

**First installation:** student PCs must receive a version supporting school updates once before future teacher-pushed updates can work. Older clients cannot receive this new command. Keep the main PC open during distribution. Actual installation requires the installed Windows application; project development mode does not install updates. Windows may still request administrator approval.

## Student imports

- Read all worksheets in an Excel workbook with Gemini, in bounded batches, then review the student preview before saving. This explicitly sends the workbook's cell contents to Gemini using the configured key.
- Copy an extraction prompt to your preferred assistant, upload the resulting JSON, or paste JSON directly. Local Excel/CSV import and column mapping remain available.
- A name is sufficient to import a student. Missing grade, section, school ID, or national number no longer discards the record. Existing class-assignment restrictions remain enforced; a restricted teacher must supply an assigned class.
- Incomplete national numbers produce a preview notice and use a generated student code or an existing saved identity. Partial updates preserve existing class information and national-login credentials.
- Existing duplicate checks, preview confirmation, national-number masking, and teacher ownership protections remain in place.

## English, Arabic, and Gemini fixes

- English question text, answer choices, explanations, written responses, editor text, and printed questions use their own reading direction. Sentence-ending punctuation, contractions, and fill-in blanks display correctly inside the Arabic interface.
- Arabic remains right-to-left; leading numbers or formulas do not incorrectly change an Arabic question's direction. Formulas retain their own left-to-right isolation.
- Simplify the output constraints sent to Gemini to avoid HTTP 400 errors caused by excessive schema complexity. Full application-side validation is retained. Rejection messages show Google's reason while redacting the API key.
- Improve Windows setup scripts, including archive extraction from Arabic workspace paths, TLS downloads, and accurate detection of an installed .NET SDK.

## Installing this preview

Use the full **Alshereqi-Exams-WebView2-1.5.5-Setup.exe** for offline installation, or the small online installer to download that same package. Both have SHA-256 checksum files. Existing school databases are kept in the existing data directory. Enable **إظهار الإصدارات التجريبية أيضًا** in the app updater to detect this preview.

Validation: all 129 automated tests pass, covering the updater, local HTTPS transfer, certificate pinning, tenant isolation, exam-installation handoff, import, text direction, PDF export and existing exam workflows. Edge browser checks cover sign-in updates, Genie/GSAP motion, teacher distribution, student countdowns, reduced motion and mobile layouts. TypeScript, production assets and Windows host compilation pass. The packaged Windows app passes checks for bundled assets and SQLite, restricted WebView2 access, teacher setup/login, TLS hosting, UDP discovery, certificate rejection and pairing. Installer execution on school PCs still depends on their Windows permissions and network configuration.
