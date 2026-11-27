/**
 * Online 3D Prop Library & Texture-Aware GLTF Proxy (`/api/props-library/*`):
 * aggregates 300+ CC0 Poly Haven 3D models + Khronos glTF-Sample-Assets, and rewrites
 * Poly Haven `.gltf` buffer/texture URIs so full PBR textures load cleanly same-origin.
 */
const KHRONOS_BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';

const CURATED_GLTF_CATALOG = [
  { id: 'kh_chair', name: 'Velvet Sheen Chair', nameAr: 'كرسي مخملي', category: 'furniture', tags: ['chair', 'furniture', 'seat'], modelUrl: `${KHRONOS_BASE}/SheenChair/glTF-Binary/SheenChair.glb`, thumb: `${KHRONOS_BASE}/SheenChair/screenshot/screenshot.jpg` },
  { id: 'kh_sofa', name: 'Modern Velvet Sofa', nameAr: 'أريكة حديثة', category: 'furniture', tags: ['sofa', 'couch', 'lounge'], modelUrl: `${KHRONOS_BASE}/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb`, thumb: `${KHRONOS_BASE}/GlamVelvetSofa/screenshot/screenshot.jpg` },
  { id: 'kh_lantern', name: 'Courtyard Lantern', nameAr: 'فانوس ساحة', category: 'nature', tags: ['lamp', 'light', 'outdoor'], modelUrl: `${KHRONOS_BASE}/Lantern/glTF-Binary/Lantern.glb`, thumb: `${KHRONOS_BASE}/Lantern/screenshot/screenshot.jpg` },
  { id: 'kh_boombox', name: 'Audio Speaker', nameAr: 'مكبر صوت', category: 'facilities', tags: ['audio', 'music', 'stage'], modelUrl: `${KHRONOS_BASE}/BoomBox/glTF-Binary/BoomBox.glb`, thumb: `${KHRONOS_BASE}/BoomBox/screenshot/screenshot.jpg` },
  { id: 'kh_camera', name: 'Lab Optical Camera', nameAr: 'كاميرا مختبر', category: 'facilities', tags: ['camera', 'lab', 'science'], modelUrl: `${KHRONOS_BASE}/AntiqueCamera/glTF-Binary/AntiqueCamera.glb`, thumb: `${KHRONOS_BASE}/AntiqueCamera/screenshot/screenshot.jpg` },
  { id: 'kh_water_bottle', name: 'Lab Flask Bottle', nameAr: 'قارورة مختبر', category: 'facilities', tags: ['lab', 'bottle', 'science'], modelUrl: `${KHRONOS_BASE}/WaterBottle/glTF-Binary/WaterBottle.glb`, thumb: `${KHRONOS_BASE}/WaterBottle/screenshot/screenshot.jpg` },
  { id: 'kh_toy_car', name: 'Physics Toy Car', nameAr: 'سيارة فيزياء', category: 'facilities', tags: ['science', 'car', 'physics'], modelUrl: `${KHRONOS_BASE}/ToyCar/glTF-Binary/ToyCar.glb`, thumb: `${KHRONOS_BASE}/ToyCar/screenshot/screenshot.jpg` },
  { id: 'kh_cesium_milk', name: 'Campus Shuttle', nameAr: 'حافلة مصغرة', category: 'facilities', tags: ['vehicle', 'bus'], modelUrl: `${KHRONOS_BASE}/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb`, thumb: `${KHRONOS_BASE}/CesiumMilkTruck/screenshot/screenshot.jpg` },
];

let cachedCatalog = null;
let cacheTime = 0;

/** Fetch all 300+ CC0 Poly Haven 3D models and merge with Khronos glTF assets. */
async function getFullOnlineCatalog() {
  if (cachedCatalog && Date.now() - cacheTime < 15 * 60 * 1000) return cachedCatalog;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 7000);
  try {
    const res = await fetch('https://api.polyhaven.com/assets?t=models', { signal: ctrl.signal });
    if (!res.ok) throw new Error('PolyHaven unavailable');
    const json = await res.json();
    const phItems = Object.entries(json).map(([slug, meta]) => ({
      id: `ph_${slug}`,
      name: meta.name || slug.replace(/_/g, ' '),
      nameAr: meta.name || slug.replace(/_/g, ' '),
      category: (Array.isArray(meta.categories) && meta.categories[0]) || 'external',
      tags: [...(Array.isArray(meta.tags) ? meta.tags : []), ...(Array.isArray(meta.categories) ? meta.categories : [])],
      thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png?width=180`,
      modelUrl: `/api/props-library/polyhaven/${encodeURIComponent(slug)}/model.gltf`,
    }));
    cachedCatalog = [...CURATED_GLTF_CATALOG, ...phItems];
    cacheTime = Date.now();
    return cachedCatalog;
  } finally {
    clearTimeout(timer);
  }
}

/** Register `/api/props-library/search`, `/polyhaven/:slug/model.gltf`, and `/file`. */
function registerPropsLibraryRoutes(app, ctx) {
  app.get('/api/props-library/search', async (req) => {
    ctx.staff(req.user);
    const q = String(req.query?.q || '').trim().toLowerCase();
    const cat = String(req.query?.cat || 'all').trim().toLowerCase();
    try {
      const all = await getFullOnlineCatalog();
      const filtered = all.filter((m) => {
        const matchCat = cat === 'all' || String(m.category).toLowerCase().includes(cat) || m.tags.some((t) => String(t).toLowerCase().includes(cat));
        const matchQ = !q || m.name.toLowerCase().includes(q) || m.tags.some((t) => String(t).toLowerCase().includes(q));
        return matchCat && matchQ;
      });
      return { source: 'polyhaven+khronos', total: all.length, items: filtered.slice(0, 200) };
    } catch {
      const fallback = CURATED_GLTF_CATALOG.filter((m) => !q || m.name.toLowerCase().includes(q) || m.nameAr.includes(q));
      return { source: 'offline-curated', total: CURATED_GLTF_CATALOG.length, items: fallback };
    }
  });

  app.get('/api/props-library/polyhaven/:slug/model.gltf', async (req, reply) => {
    const slug = String(req.params.slug || '').replace(/[^a-zA-Z0-9_-]/g, '');
    if (!slug) return reply.code(400).send({ error: 'Invalid slug' });
    const filesRes = await fetch(`https://api.polyhaven.com/files/${slug}`);
    if (!filesRes.ok) return reply.code(404).send({ error: 'Model not found' });
    const files = await filesRes.json();
    const gltfBranch = files.gltf?.['1k']?.gltf || files.gltf?.['2k']?.gltf;
    if (!gltfBranch?.url) return reply.code(404).send({ error: 'GLTF not available' });

    const gltfRes = await fetch(gltfBranch.url);
    if (!gltfRes.ok) return reply.code(502).send({ error: 'Failed to load GLTF' });
    const gltfJson = await gltfRes.json();
    const inc = gltfBranch.include || {};
    // Relative to `/api/props-library/polyhaven/:slug/model.gltf` so Three.js GLTFLoader never double-prefixes
    const wrap = (u) => `file?url=${encodeURIComponent(u)}`;

    for (const buf of gltfJson.buffers || []) {
      if (buf.uri && inc[buf.uri]?.url) buf.uri = wrap(inc[buf.uri].url);
    }
    for (const img of gltfJson.images || []) {
      if (img.uri && inc[img.uri]?.url) img.uri = wrap(inc[img.uri].url);
    }
    return reply.type('model/gltf+json').header('Cache-Control', 'public, max-age=86400').send(gltfJson);
  });

  const proxyAssetFile = async (req, reply) => {
    const raw = String(req.query?.url || '');
    if (!raw.startsWith('https://dl.polyhaven.org/') && !raw.startsWith('https://raw.githubusercontent.com/')) {
      return reply.code(403).send({ error: 'Host not allowed' });
    }
    const upstream = await fetch(raw);
    if (!upstream.ok) return reply.code(upstream.status).send({ error: 'Upstream error' });
    const buf = Buffer.from(await upstream.arrayBuffer());
    const ct = upstream.headers.get('content-type') || 'application/octet-stream';
    return reply.type(ct).header('Cache-Control', 'public, max-age=86400').send(buf);
  };

  app.get('/api/props-library/file', proxyAssetFile);
  app.get('/api/props-library/polyhaven/:slug/file', proxyAssetFile);
}

module.exports = { registerPropsLibraryRoutes };
