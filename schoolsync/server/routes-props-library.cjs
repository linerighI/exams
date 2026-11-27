/**
 * Online 3D Prop Library proxy route (`/api/props-library/search`):
 * queries the free CC0 Poly Haven 3D Models API (zero key required) and falls back
 * cleanly to curated Khronos/Poly Haven glTF models when offline on school LAN.
 */
const CURATED_ONLINE_PROPS = [
  { id: 'ext_wooden_chair', name: 'Wooden Classroom Chair', nameAr: 'كرسي خشبي', category: 'furniture', modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SheenChair/glTF-Binary/SheenChair.glb', thumb: '' },
  { id: 'ext_lantern', name: 'Courtyard Lantern', nameAr: 'فانوس ساحة', category: 'nature', modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Lantern/glTF-Binary/Lantern.glb', thumb: '' },
  { id: 'ext_plant_pot', name: 'Potted Indoor Plant', nameAr: 'نبتة داخلية', category: 'nature', modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/SpecGlossVsMetalRough/glTF-Binary/SpecGlossVsMetalRough.glb', thumb: '' },
  { id: 'ext_avocado_table', name: 'Sculpture Pedestal', nameAr: 'مجسم عرض', category: 'shapes', modelUrl: 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models/Duck/glTF-Binary/Duck.glb', thumb: '' },
];

let cachedPolyHaven = null;
let cacheTime = 0;

/** Fetch and cache public CC0 Poly Haven 3D models list (15-min TTL). */
async function fetchPolyHavenCatalog() {
  if (cachedPolyHaven && Date.now() - cacheTime < 15 * 60 * 1000) return cachedPolyHaven;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 5000);
  try {
    const res = await fetch('https://api.polyhaven.com/assets?t=models', { signal: ctrl.signal });
    if (!res.ok) throw new Error('PolyHaven unavailable');
    const json = await res.json();
    const items = Object.entries(json).slice(0, 60).map(([slug, meta]) => ({
      id: `ph_${slug}`,
      name: meta.name || slug.replace(/_/g, ' '),
      nameAr: meta.name || slug.replace(/_/g, ' '),
      category: 'external',
      tags: Array.isArray(meta.tags) ? meta.tags : [],
      thumb: `https://cdn.polyhaven.com/asset_img/thumbs/${slug}.png?width=180`,
      modelUrl: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${slug}/${slug}_1k.gltf`,
    }));
    cachedPolyHaven = items;
    cacheTime = Date.now();
    return items;
  } finally {
    clearTimeout(timer);
  }
}

/** Register `/api/props-library/search` endpoint for SARE 3D Studio. */
function registerPropsLibraryRoutes(app, ctx) {
  app.get('/api/props-library/search', async (req) => {
    ctx.staff(req.user);
    const q = String(req.query?.q || '').trim().toLowerCase();
    try {
      const live = await fetchPolyHavenCatalog();
      const filtered = q
        ? live.filter((m) => m.name.toLowerCase().includes(q) || m.tags.some((t) => String(t).toLowerCase().includes(q)))
        : live;
      return { source: 'polyhaven', items: (filtered.length ? filtered : CURATED_ONLINE_PROPS).slice(0, 24) };
    } catch {
      const fallback = q
        ? CURATED_ONLINE_PROPS.filter((m) => m.name.toLowerCase().includes(q) || m.nameAr.includes(q))
        : CURATED_ONLINE_PROPS;
      return { source: 'offline-curated', items: fallback };
    }
  });
}

module.exports = { registerPropsLibraryRoutes };
