export function pcm16FromChunks(chunks: Float32Array[], sourceRate: number) {
  if (!Number.isFinite(sourceRate) || sourceRate < 8000 || sourceRate > 192000)
    throw Error('معدل صوت غير صالح');
  const total = chunks.reduce((n, c) => n + c.length, 0),
    samples = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    samples.set(chunk, offset);
    offset += chunk.length;
  }
  const size = Math.min(480000, Math.floor((total * 16000) / sourceRate)),
    bytes = new Uint8Array(size * 2),
    view = new DataView(bytes.buffer);
  for (let i = 0; i < size; i++) {
    const a = Math.floor((i * sourceRate) / 16000),
      b = Math.max(a + 1, Math.floor(((i + 1) * sourceRate) / 16000));
    let sample = 0;
    for (let j = a; j < Math.min(b, total); j++) sample += samples[j];
    sample /= Math.max(1, Math.min(b, total) - a);
    sample = Number.isFinite(sample) ? Math.max(-1, Math.min(1, sample)) : 0;
    view.setInt16(i * 2, sample < 0 ? sample * 32768 : sample * 32767, true);
  }
  return bytes;
}
export function speechChunks(value: string) {
  const text = value
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*#`]/g, '')
    .trim();
  const parts: string[] = [];
  for (let i = 0; i < text.length;) {
    let end = Math.min(i + 600, text.length);
    if (end < text.length) {
      const space = text.lastIndexOf(' ', end);
      if (space > i + 300) end = space;
    }
    parts.push(text.slice(i, end).trim());
    i = end;
  }
  return parts.filter(Boolean);
}
