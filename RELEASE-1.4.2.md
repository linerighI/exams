# 1.4.2

- Login follows the supplied two-panel reference: glass frame, lavender gradients, animated orb illustration, restrained Arabic form and pink sign-in button. Removed the teacher-network connection choice; student LAN pairing remains available.
- Official Jordan Ministry branding is bundled for offline display on login and teacher/student headers. Source: https://moe.gov.jo/sites/all/themes/moe/images/mohe_logo_new2.png
- Bank questions awaiting review are now visible during exam creation. Open a question, review its answer and diagram, approve it, then add it to the exam. Unapproved questions and missing required diagrams are still rejected by the selection API.
- A draggable teacher assistant orb opens an in-place chat with mathematics, slash shortcuts and actionable result cards. It uses the existing authenticated assistant tools and conversation storage. It is excluded from student sessions. Dragging is constrained to the window; Alt+arrow keys move the focused orb, and Escape closes chat.
- Includes the 1.4.1 local model speed fixes.

The orb is vendored from 88lin/react-ai-orb at commit 5983e5f30b898f568786e276bf33d75ced0a981a (MIT, credits also include the original Steve0929 component). Source reference and full license are in src/vendor/ai-orb and bundled under licenses/. No microphone, remote service or WebGL dependency is added.
