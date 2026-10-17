# Teacher tools and student pages

Teachers open **الأدوات** from the main sidebar. The page includes grade selectors for 1–12, 21 subject categories (including vocational/technical subjects), semester context, search and favorites. Preferences and unfinished writing lists are stored separately for each teacher on the current device. A storage failure is displayed instead of claiming that a local list is saved.

The catalog uses compact icon tiles. Each tool opens in a focused window; Escape or the close control returns to the catalog and restores keyboard focus. Longer instructions are available on demand. See [TEACHER-LAYOUT.md](TEACHER-LAYOUT.md) for the related teacher navigation and library changes.

Eight tools work without internet or an AI key:

1. **مختبر كتابة الأسئلة**: question text and equations, four distinct options, correct-answer selection, explanation/source, topic and difficulty. Add questions to a list, then save a new unpublished exam draft and open it in the existing review editor. Grade and subject are required; saving never publishes automatically. The supported delivered exam format remains multiple choice.
2. **الآلة الحاسبة العلمية**: the bundled scientific calculator, with angle modes, roots, powers, fractions and trigonometry.
3. **GeoGebra · الرسم والهندسة**: local graphing and geometry modes. Capture the view, review its image and transfer it into the current question. The image is attached when the question is added/saved. A captured image is not an editable geometry asset; the existing question editor continues to support saved editable constructions.
4. **محرر الصيغ والمعادلات**: rendered scientific and mathematical notation, snippets and clipboard export in the app's question format.
5. **محوّل الوحدات**: metric length, mass, time, area, volume and temperature, including temperature offsets and rejection below absolute zero. The dunum used is 1,000 m². No exchange-rate conversion is included.
6. **الإحصاء السريع**: count, sum, mean, median, minimum, maximum, range and population standard deviation. Arabic/Persian digits and Arabic decimal separators are accepted. Invalid entries are rejected rather than dropped. Maximum 1,000 values.
7. **جدول مواصفات الامتحان**: proportional integer distribution of 1–100 questions across teacher-weighted units. Remainders are assigned by largest fractional remainder; the total is conserved. This planning aid does not alter a published exam's delivery rules.
8. **سُلّم تقدير الأداء**: editable task, criteria and maximum marks, with a copyable planning outline. Teachers must customize performance descriptors and partial marks. It does not introduce essay submission or automated rubric grading.

The reference library contains 17 external destinations, including the Jordanian curriculum center's textbook catalog, Ministry of Education, Darsak, Google, Google Images, Scholar, PhET, IUPAC, NASA, language resources, maps and programming resources. They require internet and open in the system browser. Jordanian sources are separated from general teaching aids; grade/edition selection and curriculum suitability must be checked within each source. The app does not claim that every general resource follows Jordan's curriculum or that every subject is taught in every grade. Search context includes the selected grade, subject and semester.

External launch requests are restricted to the resource catalog and bounded Google search URLs. The backend requires a teacher session; the student session command guard rejects the feature. There is no general native URL launcher exposed to page scripts, and external pages do not load into the trusted app WebView.

Student home, exam lists, results, search/join controls, empty states, connection notices and submission screens use the same blue/white visual system as the exam workspace. Counts use the student's real attempts and available exams. Unpublished grades remain hidden, and password-protected logout is retained.

Validation: `npm test` covers calculations, proportional allocation and URL restrictions. `npm run test:desktop:tools` verifies all eight tools, graph-to-question handoff, draft creation, native URL restrictions, favorites, student role restrictions, result privacy, exam-code entry and layouts at widths 760, 1366 and 1920. Screenshots are written to `test-results/`. External resources are opened with native launch suppressed in automation; their availability and sign-in requirements can change independently of the app.
