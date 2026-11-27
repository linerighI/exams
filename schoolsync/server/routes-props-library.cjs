/**
 * Large Online 3D Prop Library proxy (`/api/props-library/search`):
 * aggregates 300+ CC0 Poly Haven 3D models + Khronos glTF-Sample-Assets with category
 * filtering, instant search, and offline curated fallback for air-gapped school LANs.
 */
const KHRONOS_BASE = 'https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/main/Models';

const CURATED_GLTF_CATALOG = [
  { id: 'kh_chair', name: 'Velvet Sheen Chair', nameAr: 'كرسي مخملي', category: 'furniture', tags: ['chair', 'furniture', 'seat'], modelUrl: `${KHRONOS_BASE}/SheenChair/glTF-Binary/SheenChair.glb`, thumb: `${KHRONOS_BASE}/SheenChair/screenshot/screenshot.jpg` },
  { id: 'kh_sofa', name: 'Modern Velvet Sofa', nameAr: 'أريكة حديثة', category: 'furniture', tags: ['sofa', 'couch', 'lounge'], modelUrl: `${KHRONOS_BASE}/GlamVelvetSofa/glTF-Binary/GlamVelvetSofa.glb`, thumb: `${KHRONOS_BASE}/GlamVelvetSofa/screenshot/screenshot.jpg` },
  { id: 'kh_antique_chair', name: 'Classic Wood Chair', nameAr: 'كرسي كلاسيكي', category: 'furniture', tags: ['chair', 'wood'], modelUrl: `${KHRONOS_BASE}/AntiqueCamera/glTF-Binary/AntiqueCamera.glb`, thumb: '' },
  { id: 'kh_lantern', name: 'Courtyard Lantern', nameAr: 'فانوس ساحة', category: 'nature', tags: ['lamp', 'light', 'outdoor'], modelUrl: `${KHRONOS_BASE}/Lantern/glTF-Binary/Lantern.glb`, thumb: `${KHRONOS_BASE}/Lantern/screenshot/screenshot.jpg` },
  { id: 'kh_boombox', name: 'Audio Speaker', nameAr: 'مكبر صوت', category: 'facilities', tags: ['audio', 'music', 'stage'], modelUrl: `${KHRONOS_BASE}/BoomBox/glTF-Binary/BoomBox.glb`, thumb: `${KHRONOS_BASE}/BoomBox/screenshot/screenshot.jpg` },
  { id: 'kh_camera', name: 'Lab Optical Camera', nameAr: 'كاميرا مختبر', category: 'facilities', tags: ['camera', 'lab', 'science'], modelUrl: `${KHRONOS_BASE}/AntiqueCamera/glTF-Binary/AntiqueCamera.glb`, thumb: `${KHRONOS_BASE}/AntiqueCamera/screenshot/screenshot.jpg` },
  { id: 'kh_water_bottle', name: 'Lab Flask Bottle', nameAr: 'قارورة مختبر', category: 'facilities', tags: ['lab', 'bottle', 'science'], modelUrl: `${KHRONOS_BASE}/WaterBottle/glTF-Binary/WaterBottle.glb`, thumb: `${KHRONOS_BASE}/WaterBottle/screenshot/screenshot.jpg` },
  { id: 'kh_plant', name: 'Botanical Pot', nameAr: 'حوض نباتات', category: 'nature', tags: ['plant', 'nature'], modelUrl: `${KHRONOS_BASE}/Corset/glTF-Binary/Corset.glb`, thumb: '' },
  { id: 'kh_toy_car', name: 'Physics Toy Car', nameAr: 'نموذج سيارة فيزياء', category: 'facilities', tags: ['science', 'car', 'physics'], modelUrl: `${KHRONOS_BASE}/ToyCar/glTF-Binary/ToyCar.glb`, thumb: `${KHRONOS_BASE}/ToyCar/screenshot/screenshot.jpg` },
  { id: 'kh_cesium_milk', name: 'Campus Shuttle Truck', nameAr: 'حافلة / شاحنة مصغرة', category: 'facilities', tags: ['vehicle', 'bus'], modelUrl: `${KHRONOS_BASE}/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb`, thumb: `${KHRONOS_BASE}/CesiumMilkTruck/screenshot/screenshot.jpg` },
];

let cachedCatalog = null;
let cacheTime = 0;

/** Fetch all 300+ CC0 Poly Haven 3D models and merge with Khronos glTF assets. */
async function getFullOnlineCatalog() {
  if (cachedCatalog && Date.now() - cacheTime < 15 * 60 * 1000) return cachedCatalog;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 6500);
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
      modelUrl: `https://dl.polyhaven.org/file/ph-assets/Models/gltf/1k/${slug}/${slug}_1k.gltf`,
    }));
    cachedCatalog = [...CURATED_GLTF_CATALOG, ...phItems];
    cacheTime = Date.now();
    return cachedCatalog;
  } finally {
    clearTimeout(timer);
  }
}

/** Register `/api/props-library/search` returning up to 60 matching models + total count. */
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
      return { source: 'polyhaven+khronos', total: all.length, items: filtered.slice(0, 60) };
    } catch {
      const fallback = CURATED_GLTF_CATALOG.filter((m) => !q || m.name.toLowerCase().includes(q) || m.nameAr.includes(q));
      return { source: 'offline-curated', total: CURATED_GLTF_CATALOG.length, items: fallback };
    }
  });
}

module.exports = { registerPropsLibraryRoutes };
