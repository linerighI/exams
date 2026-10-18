# Alshereqi Exams 1.5.1 Preview — Update test

A small follow-up to 1.5.0 for testing the in-app update flow.

- Added a visible reminder in **Settings → تحديث التطبيق**: you can continue working during a download; the app closes only when installation starts.
- The installed version shown on that page becomes **1.5.1** after a successful update.
- Includes the same features and database format as 1.5.0.

## Test updating from 1.5.0

1. Open **الإعدادات → تحديث التطبيق** in the installed 1.5.0 app.
2. Enable **إظهار الإصدارات التجريبية أيضًا**, then choose **البحث عن تحديث**.
3. Download 1.5.1 inside the app. Finish active exams and back up school data before installation.
4. Confirm installation/restart. After reopening, check that the current version reads 1.5.1 and the new reminder appears.

The small online launcher still downloads the complete application package. The full offline installer and SHA-256 checksums are also attached. This release is a preview, and 1.5.0 remains available as the earlier version for update testing.
