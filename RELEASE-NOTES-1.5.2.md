# Alshereqi Exams 1.5.2 Preview — Arabic text and bank publishing fix

Fixes a Windows desktop transport bug that could corrupt Arabic characters when a network response split a UTF-8 character between chunks. For example, an unchanged answer could arrive as `حزن��` instead of `حزني`, causing random-exam publication to report that a bank question had changed.

- Decode desktop JSON responses continuously across network chunks, preserving Arabic and emoji.
- Apply the same protection to PDF worker text output.
- Add **تحديث الأسئلة من البنك** in the full exam editor and simple creator. This fetches approved bank copies, keeps exam question IDs and teacher audio attachments, and requires review again before publication.
- Keep the existing approval/change checks: genuinely changed or unapproved bank questions still cannot be published as stale random-pool questions.

## Repair an affected draft

After installing this patch, open the saved draft and choose **تحديث الأسئلة من البنك** in its question review. Review the refreshed questions, confirm approval, and publish. Manual questions are retained. The refresh uses the bank's current approved content, including images and the answer key.

Installing the patch prevents new transport corruption; it does not automatically rewrite previously saved drafts. No school databases or question-bank records were changed by the diagnostic checks.

This is a preview release. Enable **إظهار الإصدارات التجريبية أيضًا** in **الإعدادات → تحديث التطبيق**, then search for updates. The online launcher still downloads the full application package; the full offline installer and SHA-256 checksums are also attached.
