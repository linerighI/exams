# Alshereqi Exams 1.5.4 Preview

Teacher QR sign-in, encrypted dated backups, a refreshed student workspace and stronger exam recovery are now available in the school's blue-and-white style.

## Teacher access and full-school backups

- Create, replace or revoke your private teacher QR sign-in in Settings → Teacher accounts. Scan it with the computer camera or upload its image. Codes expire after 30 days; changing your password invalidates your code. Password sign-in remains available.
- Settings → Backups now lists dated, encrypted snapshots of the school database and all teacher databases. Each date identifies its local copy and its copy in the chosen sync folder.
- Select a folder managed by OneDrive or Google Drive for the second copy. The installed sync client performs the actual cloud upload; the app confirms the folder copy, not the provider's upload status.
- Schedule backups after changes or at a daily time while the main school computer is running. Full backups and restores wait until active exams and bank processing finish. Failed folder copies retain the local backup and can be retried.
- Restore a chosen date using the administrator password and that backup's protection phrase, then restart. Original database files are kept in a recovery directory. Cross-machine recovery from only the sync-folder copy is supported; re-enter the backup phrase to enable automatic backups on the recovered machine.

## Exams, imports and motion

- Refresh the student dashboard, exam screens and Zunis feedback to match the application's clean blue-and-white style. Add subtle GSAP wallpaper motion to sign-in and clearer connection, local-save and review indicators during exams.
- Restore the orb's blue/red/green status feedback. Completion colors do not expose grades or answer keys.
- Strengthen IndexedDB answer persistence, rapid offline answer revisions, reload recovery, queued submission and reconnect behavior.
- Improve teacher/class assignment matching and spreadsheet roster import, with clearer preview and optional AI column mapping.
- Fix school-roster students being limited to the administrator's exams. Students can see published exams from teachers assigned to their class, including randomized exams built from those teachers' approved banks. Drafts and exams for other classes remain hidden; attempts and results stay with the exam's teacher.
- Improve startup recovery when the school server is slow to start, with accurate progress and error messages instead of incorrectly blaming WebView2.
- Motion respects reduced-motion preferences. Login wallpaper pauses when the window is hidden.

## Update and data compatibility

The libraries and runtimes are included in the application package. Updating keeps the existing school data directory and databases; there is no need to install npm or animation libraries on school PCs. Update teacher and student PCs between exams, and retain a backup before updating. A backup restore deliberately replaces school data with the selected date. QR codes are private account credentials; keep their images private and retain your backup protection phrase.

This is a preview release. Enable **إظهار الإصدارات التجريبية أيضًا** in **الإعدادات → تحديث التطبيق** to detect it. The small online installer still downloads the complete application package. Full and online installers include SHA-256 checksum files.

Validation: 111 automated tests; QR sign-in and dated-backup browser workflows; recovery from only a sync-folder snapshot on another installation; native bridge authorization checks; offline/reconnect exam browser checks; TypeScript and production builds. An additional bank-to-publish browser regression verified two non-admin teachers, live student-list refresh without reloading, randomized questions from the correct bank, class isolation, teacher-specific results and restart persistence. Packaged desktop checks passed. A local HTTPS stress test with 30 simultaneous students and camera traffic preserved all answers and scores after a server restart. Physical school Wi-Fi performance still depends on the network and host hardware.
