import { z } from 'zod';
const name = z.string().regex(/^[A-Za-z][A-Za-z0-9_]{0,15}$/);
export const constructionSchema = z.object({
  objects: z
    .array(
      z.discriminatedUnion('type', [
        z.object({
          type: z.literal('point'),
          name,
          x: z.number().min(-1000).max(1000),
          y: z.number().min(-1000).max(1000),
        }),
        z.object({
          type: z.literal('circle'),
          name,
          center: name,
          radius: z.number().positive().max(1000),
        }),
        z.object({ type: z.literal('segment'), name, from: name, to: name }),
        z.object({ type: z.literal('line'), name, from: name, to: name }),
        z.object({ type: z.literal('angle'), name, from: name, vertex: name, to: name }),
        z.object({
          type: z.literal('label'),
          name,
          text: z.string().regex(/^[A-Za-z0-9 α-ωΑ-Ω=+\-°]{1,30}$/),
          x: z.number().min(-1000).max(1000),
          y: z.number().min(-1000).max(1000),
        }),
      ]),
    )
    .max(50),
});
export function geometryCommands(input: unknown) {
  const construction = constructionSchema.parse(input);
  const points = new Set<string>(),
    names = new Set<string>();
  return construction.objects.map((o) => {
    if (names.has(o.name)) throw Error('اسم هندسي متكرر');
    names.add(o.name);
    if (o.type === 'point') {
      points.add(o.name);
      return `${o.name}=(${o.x},${o.y})`;
    }
    if (o.type === 'label') return `${o.name}=Text("${o.text}",(${o.x},${o.y}))`;
    const refs =
      o.type === 'circle'
        ? [o.center]
        : o.type === 'angle'
          ? [o.from, o.vertex, o.to]
          : [o.from, o.to];
    if (refs.some((p) => !points.has(p))) throw Error('حدد النقاط قبل استخدامها');
    return o.type === 'circle'
      ? `${o.name}=Circle(${o.center},${o.radius})`
      : o.type === 'angle'
        ? `${o.name}=Angle(${o.from},${o.vertex},${o.to})`
        : `${o.name}=${o.type === 'line' ? 'Line' : 'Segment'}(${o.from},${o.to})`;
  });
}
