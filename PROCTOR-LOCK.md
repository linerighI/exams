# Zunis proctor lock

A teacher can use the three-dot Zunis action on a live camera card, focused device, or attempt row to show or remove the cheating warning for that specific attempt. It is a reversible proctor decision, not automatic camera-based cheating detection or an automatic grade penalty.

The student receives the decision through the existing three-second attempt-status poll. The warning uses the existing exam-introduction visual system with a persistent red variant, native modal focus containment and reduced-motion support. It cannot be dismissed with Escape or by submitting answers. Unlocking restores the existing attempt without resetting its deadline or clearing answers. Repeating the same decision is idempotent.

The timer always continues. Normal server deadline expiry remains in force. A warning can remain visible after expiry until the teacher removes it, after which the student sees the submitted state. Camera permissions, exemptions and streaming rules remain unchanged during an active attempt.

The teacher-only endpoint `PUT /api/attempts/:id/proctor-lock` accepts `{active:boolean}`. The state and timestamps persist in the attempt JSON and changes are audited. Locked answer and submit requests return HTTP 423. Existing local pending answers remain queued, and an already-received lock remains visible offline until reconnection delivers an unlock. A disconnected device cannot receive a newly issued decision until it reconnects.

Verification: API tests cover teacher/student and teacher-account scope, repeated actions, blocked writes and submission, camera requests and streaming, unchanged deadlines, restart recovery, preserved answers, grading and automatic expiry. Browser verification covers the proctor action, red warning, persistent display beyond the intro duration, Escape blocking, countdown, live unlocking and re-locking without refreshing the student session.
