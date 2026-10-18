# Teacher creation, connections and updates

## One school host

The desktop backend rejects host promotion on a remotely paired client, including after a student logs out or the teacher becomes temporarily unreachable. A new unpaired host searches the LAN before binding its school server. Starting hosts announce their state and arbitrate simultaneous starts; an existing active host takes priority. The welcome page displays the reason and highlights the connection orb so the user can pair with the existing host.

Discovery depends on a working school LAN and permitted UDP discovery traffic. Saved pairing blocks client promotion independently of discovery; disconnected or partitioned LANs cannot establish global exclusivity. No school database is deleted when a host start is rejected.

## Manual banks and exams

- In **إضافة بنك أسئلة**, enter title, subject and grade, then choose **إنشاء بنك فارغ يدويًا**. No PDF, AI account, prompt or generation job is required.
- Open any bank and choose **إضافة سؤال يدويًا**. Write four distinct answers, choose the correct one, add the teacher explanation, and optionally attach a PNG/JPEG. Questions can be saved as drafts or explicitly approved. A question that requires an image cannot be approved without it.
- In the exam editor, choose **إنشاء امتحان فارغ يدويًا**. Blank exams can be saved as drafts; publishing still requires valid questions and teacher review.
- **الوضع المبسط** in the teacher header provides details, manual writing or approved bank selection, picture previews, balanced random selection, review and publication in one page. The choice is saved separately for each teacher account. Bank creation/import opens in a dialog without discarding the current exam. Publishing retries reuse the saved draft.

## Picture-aware prompts

The **تضمين صور ورسوم وأسئلة تعتمد على الشكل** checkbox defaults on. It tells the selected provider to make diagram-dependent questions, especially graphs, geometry, circuits and force diagrams. Existing textbook figures use source-page crop coordinates; new simple diagrams use the established sanitized SVG import path. Teachers can also upload their own images. Turning it off requests self-contained text questions.

The provider must actually return the diagram/crop information; the app does not pretend a missing image exists. Existing import validation, SVG sanitization, image review and approval gates still apply. Custom prompt editing is preserved, with the chosen picture preference appended to the actual exported prompt.

## GitHub application updates

The installed desktop app checks `linerighI/exams` on teacher login, when connectivity returns, and every six hours. Checks show a notification; downloads and installation require explicit clicks. The update panel shows release notes, bytes downloaded, progress, pause/resume and confirmation before closing.

Stable releases are the default; previews are opt-in. A release must have a higher three-part version and a full `Alshereqi-Exams-WebView2-X.Y.Z-Setup.exe` asset with GitHub's SHA-256 digest or a matching `.sha256` asset. Always bump both `package.json` and `desktop/native/Alshereqi.Desktop.csproj` to the release version before building. Upload the complete installer and checksum before publishing the release. The tiny online bootstrap is not the in-app update payload.

Downloads are retained on interruption, verified before being marked ready, and verified again before installation. Installing is blocked in student sessions, during active exams, and in the source/development checkout. The native helper waits for the app/server to exit, verifies the package again, requests Windows elevation for installation, records its result under the update cache and relaunches the app. Existing school data remains in its normal LocalAppData directory.

Existing installations need this new app build once before they can use the updater. These code changes do not retrofit the previously published installer. A full elevated upgrade on a second clean Windows PC remains a manual release check; automated tests never silently install over the working school app.
