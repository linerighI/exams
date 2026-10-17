using System.Text;
using SherpaOnnx;

namespace Alshereqi.Desktop;

internal static class OfflineSpeech
{
    private static string Asr(string root, string file) => Path.Combine(root, "speech", "models", "sherpa-onnx-whisper-base", file);
    private static string Voice(string root, string lang) => Path.Combine(root, "speech", "models", lang == "ar" ? "vits-piper-ar_JO-kareem-medium-int8" : "vits-piper-en_US-amy-low-int8");
    public static object Status(string root) => new {
        engine = "sherpa-onnx", offline = true,
        ready = File.Exists(Asr(root, "base-encoder.int8.onnx")) && File.Exists(Asr(root, "base-decoder.int8.onnx")) &&
            File.Exists(Asr(root,"base-tokens.txt")) &&
            new[] {"ar","en"}.All(lang => File.Exists(Path.Combine(Voice(root,lang),lang=="ar"?"ar_JO-kareem-medium.onnx":"en_US-amy-low.onnx")) &&
                File.Exists(Path.Combine(Voice(root,lang),"tokens.txt")) && File.Exists(Path.Combine(Voice(root,lang),"espeak-ng-data","phondata")))
    };
    private static void Require(string path) { if (!File.Exists(path)) throw new Exception("ملفات الصوت المحلي غير مكتملة. أعد تثبيت التطبيق أو شغّل npm run speech:setup في نسخة التطوير."); }
    public static object Transcribe(string root, string pcm, string language)
    {
        if (language is not ("ar" or "en")) throw new Exception("لغة الإملاء غير مدعومة");
        if (pcm.Length > 1280000) throw new Exception("الحد الأقصى للإملاء 30 ثانية");
        var bytes = Convert.FromBase64String(pcm);
        if (bytes.Length < 3200 || bytes.Length > 960000 || bytes.Length % 2 != 0) throw new Exception("مقطع صوتي غير صالح");
        var samples = new float[bytes.Length / 2];
        double energy = 0;
        for (int i=0;i<samples.Length;i++) { samples[i] = System.Buffers.Binary.BinaryPrimitives.ReadInt16LittleEndian(bytes.AsSpan(i*2,2))/32768f; energy += samples[i]*samples[i]; }
        if (energy / samples.Length < 0.000001) return new { text = "" };
        string encoder=Asr(root,"base-encoder.int8.onnx"),decoder=Asr(root,"base-decoder.int8.onnx"),tokens=Asr(root,"base-tokens.txt");
        Require(encoder);Require(decoder);Require(tokens);
        var config = new OfflineRecognizerConfig();
        config.ModelConfig.Whisper.Encoder=encoder;config.ModelConfig.Whisper.Decoder=decoder;
        config.ModelConfig.Whisper.Language=language;config.ModelConfig.Whisper.Task="transcribe";
        config.ModelConfig.Tokens=tokens;config.ModelConfig.NumThreads=2;config.ModelConfig.Provider="cpu";
        config.FeatConfig.SampleRate=16000;config.FeatConfig.FeatureDim=80;
        using var recognizer = new OfflineRecognizer(config);
        using var stream = recognizer.CreateStream();
        stream.AcceptWaveform(16000,samples);recognizer.Decode(stream);
        return new { text=stream.Result.Text.Trim() };
    }
    public static object Speak(string root, string text, string language)
    {
        if (language is not ("ar" or "en") || text.Length is <1 or >700) throw new Exception("نص القراءة غير صالح");
        string directory=Voice(root,language),model=Path.Combine(directory,language=="ar"?"ar_JO-kareem-medium.onnx":"en_US-amy-low.onnx"),tokens=Path.Combine(directory,"tokens.txt");
        Require(model);Require(tokens);
        Require(Path.Combine(directory,"espeak-ng-data","phondata"));
        var config = new OfflineTtsConfig();
        config.Model.Vits.Model=model;config.Model.Vits.Tokens=tokens;
        config.Model.Vits.DataDir=Path.Combine(directory,"espeak-ng-data");
        config.Model.NumThreads=2;config.Model.Provider="cpu";config.MaxNumSentences=1;
        using var tts = new OfflineTts(config);
        var audio=tts.Generate(text,1f,0);
        var samples=audio.Samples;int rate=audio.SampleRate;
        if (samples.Length==0 || samples.Length>rate*120) throw new Exception("تعذر إنشاء مقطع الصوت");
        using var memory=new MemoryStream();using var writer=new BinaryWriter(memory,Encoding.ASCII,true);
        int size=samples.Length*2;
        writer.Write(Encoding.ASCII.GetBytes("RIFF"));writer.Write(36+size);writer.Write(Encoding.ASCII.GetBytes("WAVEfmt "));
        writer.Write(16);writer.Write((short)1);writer.Write((short)1);writer.Write(rate);writer.Write(rate*2);writer.Write((short)2);writer.Write((short)16);
        writer.Write(Encoding.ASCII.GetBytes("data"));writer.Write(size);
        foreach (var sample in samples) writer.Write((short)Math.Clamp((int)(sample*32767),short.MinValue,short.MaxValue));
        writer.Flush();return new { audio="data:audio/wav;base64,"+Convert.ToBase64String(memory.ToArray()),sampleRate=rate };
    }
}
