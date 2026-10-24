# School services

The app exposes three independently versioned implementation layers in Settings → الخدمات and in the footer: **Zunis 1** for the existing protection controls, **Animato 1** for the shared GSAP engine and service-screen motion, and **LANED 1** for service routing and quality checks. These numbers describe the initial service contracts, independently of the application release version. The existing protection and motion systems remain in use.

Subject services are **Arabic 1**, **English 1**, and **Math/science 1**. Subject metadata selects the prompt rules; mathematics, physics, chemistry and science share the math/science service. Saved custom bank prompts also receive the current subject rules so an older Arabic-only prompt does not override an English bank. No student records are added to prompts.

## Math/science 1

- Teacher-only local drawing tools create bounded polynomial graphs, right triangles and signed force diagrams from supplied numeric parameters. They export PNG for banks and can attach directly to exam questions. They do not solve the question or add a resultant/hypotenuse answer.
- Existing GeoGebra generation now returns recognized polynomial constructions immediately without calling an AI provider. Other geometry still uses the configured provider or manual editor.
- One KaTeX renderer, including the bundled mhchem extension, handles preview, bank-import checks, quality review and printed mathematics/chemical reactions.
- Checks catch unsupported displayed formulas, incomplete equation delimiters, missing required drawings and equivalent simple numeric options such as `1/2`, `0.5` and `50%`. Arithmetic parsing is bounded and does not execute user expressions. Distinct units and symbolic expressions are not treated as interchangeable numeric values.
- Math/science publication and individual/bulk bank approvals enforce the checks on the server. Publication returns question/field paths for the existing guided error navigation. Drafts can retain issues while the teacher fixes them.
- These checks do **not** prove solutions, dimensional consistency, chemical balance or geometric truth. The prompt asks the provider to review those; a teacher must independently review and approve the result. Live provider quality has not been certified by local automated tests.
- Student footer dialogs show the layer information without offering teacher drawing controls. The drawing/check API requires teacher authorization.

New service transitions use scoped GSAP contexts and live reduced-motion preferences; there are no new perpetual animation loops. Existing databases need no migration for optional question image-requirement flags. No release is created automatically by these changes.

Validation: `npm test`, TypeScript and Vite production build; Playwright CLI checks of service navigation, safe student overview, diagram preview/export/attachment, and responsive layout. Service-specific regression cases are in `tests/services.test.ts`.
