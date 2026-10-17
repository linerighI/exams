# Question bank library

The teacher's question bank now opens as a folder and book gallery. The action row provides bank import/request preparation, original PDF upload and folder creation. Soft blue, mint, violet, amber and rose surfaces distinguish folders and book covers while preserving the existing school theme.

Create a folder with a name and color; its menu supports renaming/recoloring and removal. Select a folder to see its books, or use **كل الكتب** and **غير مصنف**. Book cards contain actual title, subject, grade and question count, with lightweight document-cover artwork. Search, name/date/question-count sorting and grid/list views are available. Select book checkboxes to move multiple books, or use a book's move control. A book remains in one folder at a time. Removing a folder returns its books to **غير مصنف** and never deletes books or questions.

Importing or uploading from inside a folder places the resulting book there. Opening a book uses the full width for question review and retains the existing source-file, export, page selection, generation and exam-draft controls. **العودة إلى المكتبة** returns to the previous browsing context.

Organization is stored in the teacher-scoped SQLite settings under `library-organization`, separately from book records so long-running generation/import jobs cannot overwrite it. Existing backups include and restore it. All folder endpoints require teacher authorization; folder and book IDs resolve only in that teacher's store. Moves validate all book IDs before saving a single atomic setting update.

Validation: `npm test` includes persistence after restart, duplicate/invalid input, teacher/student access, atomic move failures, safe folder removal and backup/restore. `npm run test:desktop:library` covers folder creation/rename/color/delete, bulk/single moves, search/list/grid, question review, import into the selected folder, and captures 760/1366/1920 layouts in `test-results/library-*.png`. `npm run test:ui` continues to cover PDF upload, external bank import, editing and exam delivery.

## Open bank dashboard

The open bank uses three status summaries, a searchable question board and compact chapter/difficulty panels. Counts and distribution bars derive from the loaded backend questions. Clicking summaries or chapter/difficulty rows filters the question board. Advanced filters are collapsed by default, with a visible reset for active filters. Questions are paginated in groups of 12, with the full text and editing available through question review. Files, PDF export, source attachment, generation and page exclusions open in a separate window; exam drafting has its own window. The library folder layout and all backend operations remain unchanged.

## Selection and folders inside a bank

Each bank has its own teacher-scoped colored folders, separate from library folders. Questions can be moved by dragging one card or an existing selection onto a folder, or through the Move window. Folder deletion only removes organization and returns questions to unfiled. Organization is in SQLite settings and included in backups.

Drag on the space between cards to draw a blue selection rectangle. Checkboxes, Ctrl-click, Shift-click, Ctrl+A on the grid, select-page and select-all (up to 500) are available. Selection survives pagination. The toolbar approves, returns to draft, moves or deletes the selected questions; deletion requires an in-app confirmation. Backend batches validate ownership and the whole approval batch before any write, including required images and damaged text. Writes are transactional and preserve card order. These actions are teacher-only.

The pencil beside a chapter renames it in all its bank questions. Damaged stored labels are explicitly identified for correction; lost characters are never guessed. JSON file imports decode UTF-8 strictly and reject replacement characters in core text fields. Arabic chapter labels have explicit RTL shaping and a more readable size.
