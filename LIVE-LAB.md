# Live classroom

The teacher can open **غرفة المتابعة المباشرة** from the dashboard orb, from a student's camera action, or from the large bottom-right notification. The notification appears while attempts are active or student devices are online, with a slow blue/red glow. Reduced-motion preferences disable the glow. The workspace is temporary, has a close button at the top right, and keeps the existing blue/white style.

Its right navigation has four sections:

- **الأجهزة**: authenticated student app instances, connection state, student/class, exam and received-answer count. Selecting a computer opens its details, last contact, platform, progress and camera when available.
- **الإجابات**: progress received by the teacher's backend. Offline answers appear only after synchronization; this view does not invent local progress or imply that a background device is online.
- **الكاميرات**: live camera tiles, individual/all-camera requests, stop controls and a larger view from the device details. Placeholder states distinguish no active exam, exemption, pending approval, stopped/unavailable camera and disconnection.
- **التنبيهات**: disconnected devices, camera failures/pauses, app background state and late-answer reviews. The combined dashboard still provides acceptance/rejection, grades, publication, CSV export, availability closing and attempt reopening.

Only student devices running the app and signed in to this teacher appear. Device IDs are per app/browser session. No Windows device discovery, desktop recording or remote-control agent is installed. Presence refreshes every four seconds; a device becomes offline after fifteen seconds without a heartbeat. Records are removed after five minutes or when the login token is no longer valid.

Camera broadcasting starts after a teacher request and a visible student approval prompt. It uses the trusted app camera permission and still requires an available camera/Windows permission. Audio is disabled. Current exemptions are enforced on every request/frame. A visible student banner provides a stop control. The feed is intentionally low rate for weaker machines: 480×270 JPEG frames at approximately one frame per second, refreshed on the teacher's page about every 1.5 seconds. This is a live image feed, not full-motion video.

The backend retains only the latest frame in memory, per device. Frames are never inserted into school tables or backups; responses prohibit browser caching. Frames older than six seconds disappear. Closing the room clears requests/frames and stops camera tracks on the next student heartbeat. A twenty-second renewable viewing lease provides an additional stop boundary if the teacher closes unexpectedly. Network errors, logout, exemptions, exam expiry/submission and component disposal stop/reject broadcasting. Legacy saved photos remain readable for existing school records; the current teacher/student UI requests live broadcasting instead of taking new snapshots.

All lab data/frames are scoped to the authenticated teacher store. Student endpoints validate ownership, attempt association, live request, viewer lease, current exemption, payload size and upload interval. Other students cannot list devices or fetch camera frames. The native app continues using its private JSON bridge and pinned teacher connection.

Validation:

- `npm test`: tenant separation, denied student reads, camera-request requirements, payload/rate checks, stale frames, expiry, exemption, repeat requests, submission and no frame content in backups.
- `npm run test:lab`: separate teacher/student browser contexts with a synthetic camera. Exercises presence, device details, automatic answer progress, continuously changing frames, visible consent/banner, repeated requests, and camera-track shutdown on room close/submission.
- `npm run test:desktop:lab`: synthetic camera in actual WebView2, frame upload through the native bridge, teacher retrieval and stop cleanup. Fake-camera switches are honored only inside the existing test-mode guard; production launches cannot enable them.

Real classroom camera quality, firewall behavior and aggregate load still need a multi-PC check on the school's network. Synthetic tests do not measure that deployment's performance.
