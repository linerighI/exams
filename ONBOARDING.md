# First-launch films

The first-launch view is a compact blue-and-white welcome panel, with immediate teacher/student choices beside a small illustrative exam preview. A finite ten-second GSAP timeline animates the sheet, answer selection and progress; Skip immediately finishes the preview. No Remotion player is loaded on the landing page. Choosing a role only selects the corresponding existing sign-in screen; it does not authenticate an account or start a school server.

After a first fresh sign-in on this device, teachers and students get their own ten-second, skippable introduction. Markers are scoped to school, role and account; they contain no passwords, student passcodes or authentication tokens. The existing teacher tour remains available manually, while its automatic welcome is suppressed after the new teacher film. Restored sessions and active attempts bypass the account film.

The films are real Remotion compositions played locally through `@remotion/player`. They are silent, do not loop, pause in hidden windows, and unmount when dismissed. Reduced-motion mode removes the artwork motion. Skip/role controls remain available if a lazy chunk, font or player fails. No MP4 is downloaded, generated or required, and no student records appear in the illustrative artwork.

## Studio

Run `npm ci` in the application folder, then `npm ci --prefix onboarding-video`, and `npm run video:studio`. The three editable, 300-frame / 30 fps compositions are:

- `AppIntroduction`
- `TeacherIntroduction`
- `StudentIntroduction`

The shared film implementation lives in `onboarding-video/src/WelcomeFilm.tsx`. The app lazily loads it after the first-launch view opens. Arabic fonts are bundled locally; the same font assets are supplied in the app's `public/onboarding-fonts` and Studio's public directory. Build dependencies and versions are pinned in the two lockfiles. Studio is a development tool and is not started or packaged with the school app. Videos are previews/compositions; no MP4 export was requested.

The Remotion packages are pinned to 4.0.537.
