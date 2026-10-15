const sharp = require('sharp');
const fs = require('node:fs');
const svg = Buffer.from(
  '<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256"><defs><linearGradient id="g" x2="1" y2="1"><stop stop-color="#56aaff"/><stop offset="1" stop-color="#2462d9"/></linearGradient></defs><rect width="256" height="256" rx="58" fill="url(#g)"/><circle cx="62" cy="192" r="85" fill="#fff" opacity=".06"/><path d="M36 101L128 60L220 101L128 142Z" fill="#fff"/><path d="M73 126V169Q128 205 183 169V126L128 151Z" fill="#d9edff"/><path d="M211 107V166" stroke="#fff" stroke-width="8" stroke-linecap="round"/><circle cx="211" cy="173" r="9" fill="#fff"/><path d="M66 37l5 12 12 5-12 5-5 12-5-12-12-5 12-5Z" fill="#ffdc83"/></svg>',
);
(async () => {
  fs.mkdirSync('build', { recursive: true });
  const sizes = [16, 32, 48, 64, 128, 256];
  const images = await Promise.all(
    sizes.map((size) => sharp(svg).resize(size, size).png().toBuffer()),
  );
  const header = Buffer.alloc(6 + 16 * sizes.length);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(sizes.length, 4);
  let offset = header.length;
  sizes.forEach((size, i) => {
    const n = 6 + i * 16;
    header[n] = size === 256 ? 0 : size;
    header[n + 1] = header[n];
    header.writeUInt16LE(1, n + 4);
    header.writeUInt16LE(32, n + 6);
    header.writeUInt32LE(images[i].length, n + 8);
    header.writeUInt32LE(offset, n + 12);
    offset += images[i].length;
  });
  fs.writeFileSync('build/icon.ico', Buffer.concat([header, ...images]));
  await sharp(svg).png().toFile('build/icon.png');
})();
