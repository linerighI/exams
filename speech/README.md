# Bundled speech assets

Engine: [k2-fsa/sherpa-onnx](https://github.com/k2-fsa/sherpa-onnx), Apache-2.0, .NET package 1.13.8. Native ONNX Runtime and speech dependencies ship through the NuGet package. Upstream sherpa-onnx, Whisper, ONNX Runtime and eSpeak NG notices are included in `notices/`, which is copied with the models during packaging.

Recognition: multilingual [OpenAI Whisper](https://github.com/openai/whisper) base, MIT, converted int8 encoder/decoder/token assets from the official sherpa-onnx `asr-models` release. Engine licensing and model/data licensing are separate.

Arabic synthesis: `vits-piper-ar_JO-kareem-medium-int8`, 22,050 Hz. Upstream model card references [arabicttstrain](https://github.com/AliMokhammad/arabicttstrain/) for dataset/license information and states it was fine-tuned from Lessac. The original `MODEL_CARD` and ONNX JSON configuration are preserved beside the model.

English synthesis: `vits-piper-en_US-amy-low-int8`, 16,000 Hz. Upstream model card references [Mycroft mimic3 voices](https://github.com/MycroftAI/mimic3-voices) for dataset/license information and states it was fine-tuned from Ryan. Its original card/configuration are preserved. Piper voices are distributed in the official sherpa-onnx `tts-models` release. These model cards do not grant the engine's Apache license to all voice/data assets.

`downloads.json` pins official archive URLs, byte sizes and SHA-256 values. `models-manifest.json` checks extracted runtime files. Run `npm run speech:setup` to provision; do not manually edit models or manifests. Runtime performs local inference only. See ../DICTATION.md for controls and validation limits.
