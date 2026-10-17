# Offline AI voice

The teacher's main and floating AI composers use a microphone button, Arabic/English selection and editable transcript. Click the microphone, speak, then stop (maximum 30 seconds). Recognition happens after recording stops. Nothing is sent to the assistant automatically. Each assistant reply has a **قراءة الرد** button and a stop button for local spoken playback.

Speech runs through [sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), pinned .NET package `org.k2fsa.sherpa.onnx` 1.13.8. Recognition uses multilingual Whisper base int8; synthesis uses Piper Kareem ar_JO medium int8 and Amy en_US low int8. Models run on CPU with two threads and are loaded only on demand, then disposed. This favors smaller downloads and idle memory over instant response. Arabic transcription can make spelling and dialect errors: always review the draft. This is push-to-talk with optional readback, not an always-listening voice call.

Raw microphone audio remains in memory on the device, moves through private Node/native JSON IPC and is not saved or uploaded to a speech service. The selected AI provider receives only the message text when the teacher presses send. Cloud AI providers still need internet. Starting playback stops recording, starting recording stops playback, and hiding/removing the page releases recording/playback. Cancel discards pending recognition output; an already-running native inference finishes but its result is ignored. Windows microphone permissions still apply.

All three speech bridge commands require an authenticated teacher in the backend and the native shell. Microphone permission requires the trusted top-level app origin, teacher authentication and no student lockdown session. Input size, language and PCM duration are bounded; concurrent native speech jobs are rejected. Students have no controls or native speech access. Browser SpeechRecognition and Windows voice typing are not used by this feature.

## Build and distribution

Run `npm run speech:setup` once on a development machine to download the official archives in `speech/downloads.json`. The script verifies pinned archive sizes/SHA-256, extracts models and writes a file manifest. `npm run build` checks required model hashes. `npm run dist` includes speech models and native libraries, omitting unused float32 Whisper weights; installation and speech use require no internet. Model cards and notices remain bundled. See [speech/README.md](speech/README.md) for upstream attribution.

## Validation

`npm test` checks resampling, PCM clipping, invalid rate rejection, the 30-second bound and synthesis chunk limits. `npm run test:desktop:speech` runs real Arabic/English TTS through real Whisper recognition in WebView2, injects generated speech into the actual microphone recording pipeline, checks draft-only behavior, microphone denial, silence, malformed input, readback controls, both composers and teacher/student authorization. Generated WAV samples and screenshots are written under `test-results/`. Playback itself is silenced in automation. A physical microphone, speaker quality and human Arabic/dialect accuracy require manual checks.

Chromium API availability does not establish that WebView2's speech recognition service is usable. Microsoft tracks a [WebView2 speech network failure](https://github.com/MicrosoftEdge/WebView2Feedback/issues/5724). The local engine avoids that service dependency.
