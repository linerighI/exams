/**
 * 3D Spatial Campus room-label & class-mapping persistence routes for Principal/Assistant.
 */
const { z } = require('zod');

const roomEntrySchema = z.object({
  slot_id: z.string().trim().min(1).max(48),
  label: z.string().trim().max(100),
  kind: z.enum([
    'classroom',
    'principal',
    'teachers',
    'reception',
    'counselor',
    'auditorium',
    'library',
    'lab',
    'courtyard',
    'custom',
  ]),
  class_name: z.string().trim().max(80).default(''),
  wing: z.enum(['west-main', 'west-lower', 'east', 'north', 'courtyard']).default('west-main'),
});

/** Register 3D spatial room customization routes (`/api/spatial-rooms`). */
function registerSpatialRoutes(app, ctx) {
  const { run, audit, schoolManager } = ctx;

  app.post('/api/spatial-rooms', async (req) => {
    const u = req.user;
    schoolManager(u);
    const body = z
      .union([
        roomEntrySchema,
        z.object({ rooms: z.array(roomEntrySchema).min(1).max(40) }),
      ])
      .parse(req.body);
    const items = 'rooms' in body ? body.rooms : [body];

    ctx.db.transaction(() => {
      for (const r of items) {
        run(
          `INSERT INTO spatial_rooms(school_id,slot_id,label,kind,class_name,wing)
           VALUES(?,?,?,?,?,?)
           ON CONFLICT(school_id,slot_id) DO UPDATE SET
             label=excluded.label,
             kind=excluded.kind,
             class_name=excluded.class_name,
             wing=excluded.wing`,
          u.school_id,
          r.slot_id,
          r.label,
          r.kind,
          r.class_name,
          r.wing,
        );
      }
      audit(u, `Updated ${items.length} spatial room label(s)`);
    })();

    return { ok: true, count: items.length };
  });
}

module.exports = { registerSpatialRoutes };
