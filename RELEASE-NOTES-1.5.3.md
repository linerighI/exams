# Alshereqi Exams 1.5.3 Preview

Create and review exams in a clearer Arabic workspace, with drag-and-drop questions, richer answer formats, guided validation and GSAP motion matching the school's blue style.

## Exams and question banks

- Nine question types: single choice, multiple choice, true/false, short answer, extended writing, fill in the blanks, matching, ordering, and pen/drawing responses with a typed alternative.
- Drag questions into the editor, reorder with a handle or keyboard buttons, duplicate, undo deletion, and preview the student's view without exposing answer keys.
- AI bank prompts, built-in generation, manual editing, JSON import, bank selection and bank PDFs understand the different question types. Teachers can choose which types to request.
- Optional keyword/concept groups and synonyms suggest partial marks for written answers. A teacher must review and approve them; mentioning a few words never automatically passes an answer. Students see only the required concept count.
- Errors identify the relevant question or field. Click an issue to open the correct step and highlight it without losing the draft.

## Import and reliability

- Excel roster import recognizes more Arabic column names and searches later worksheets. National IDs are optional; students without them receive login passcodes. Review the preview before committing.
- An optional AI helper suggests Excel column mappings using headings and cell-type counts, rather than student records. It requires a configured AI provider. Older XLS files must be saved as XLSX.
- Preserve offline answer queues while checking that cached attempts match the selected student and exam. Distinguish login errors from network disconnections and use a smaller status heartbeat.
- Keep Arabic text intact across desktop/PDF response chunks and retain the bank-refresh repair for previously affected drafts.

## Motion and feedback

GSAP MorphSVG and Flip provide morphing icons, moving navigation/step indicators, color and font previews, question transitions, dialog entrances, save receipts, and clearer notifications. Saving a question returns focus to the next question. Motion respects live reduced-motion preferences; active student answer controls remain steady.

## Updating an existing installation

The new libraries are bundled with the app. No separate npm, GSAP, Python, or Node installation is needed on school PCs. The installer uses the same application directory and keeps school databases and WebView2 profiles in LocalAppData; this update does not erase them. Existing multiple-choice exams remain supported. Make a backup from Settings before updating, and update the teacher and student PCs before using new question types. Do not update during an active exam.

This remains a preview release. In **الإعدادات → تحديث التطبيق**, enable **إظهار الإصدارات التجريبية أيضًا**, then check for updates. The online installer is a small launcher that still downloads the complete application package. Both installers and SHA-256 files are included in the GitHub release.

Validation includes the automated regression suite, browser workflows for the new exam/Excel/motion features, TypeScript, and production builds. Packaged desktop checks are performed separately before publication. Physical school Wi-Fi and every third-party spreadsheet layout cannot be guaranteed by local tests.
