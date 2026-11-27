/**
 * Shared Zod validation schemas for SARE 3D Campus blueprints (`CampusLayout`),
 * rooms, openings, wings, floors, props, and compact SAR submissions.
 */
const { z } = require('zod');

const openingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  wall: z.enum(['N', 'S', 'E', 'W']),
  wallIndex: z.number().int().min(0).max(15).optional(),
  offset: z.number().min(-40).max(40),
  width: z.number().min(0.6).max(12),
  height: z.number().min(0.6).max(5),
  type: z.enum(['door', 'double_door', 'window', 'arch']),
});

const assignmentSchema = z.object({
  id: z.string().trim().min(1).max(64),
  title: z.string().trim().min(1).max(120),
  type: z.enum(['duty', 'exam', 'homework_zone', 'event']).default('duty'),
  assigneeId: z.string().trim().max(80).default(''),
  dueAt: z.string().trim().max(40).default(''),
  offsetX: z.number().min(-25).max(25).default(0),
  offsetZ: z.number().min(-25).max(25).default(0),
});

const roomSchema = z.object({
  id: z.string().trim().min(1).max(64),
  floorId: z.string().trim().min(1).max(64),
  wingId: z.string().trim().min(1).max(64),
  kind: z.enum([
    'classroom', 'principal', 'teachers', 'reception', 'counselor',
    'auditorium', 'library', 'lab', 'courtyard', 'corridor',
    'stairs', 'restroom', 'assignment_zone', 'custom',
  ]),
  label: z.string().trim().max(120).default(''),
  className: z.string().trim().max(80).default(''),
  x: z.number().min(-200).max(200),
  z: z.number().min(-200).max(200),
  width: z.number().min(1.5).max(100),
  depth: z.number().min(1.5).max(100),
  points: z
    .array(z.object({ x: z.number().min(-60).max(60), z: z.number().min(-60).max(60) }))
    .min(3)
    .max(16)
    .optional(),
  rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2).default(0),
  wallHeight: z.number().min(0.1).max(8).default(3.2),
  wallThickness: z.number().min(0.08).max(0.8).default(0.2),
  wallColor: z.string().trim().max(24).optional(),
  floorColor: z.string().trim().max(24).optional(),
  roomState: z.enum(['normal', 'highlight', 'note', 'alert', 'maintenance']).optional(),
  stateNote: z.string().trim().max(180).optional(),
  openEdges: z.array(z.number().int().min(0).max(15)).max(16).optional(),
  openings: z.array(openingSchema).max(24).default([]),
  assignments3D: z.array(assignmentSchema).max(24).default([]),
});

const floorSchema = z.object({
  id: z.string().trim().min(1).max(64),
  index: z.number().int().min(-3).max(12),
  labelAr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  elevationY: z.number().min(-20).max(60),
  ceilingHeight: z.number().min(2).max(8).default(3.4),
});

const wingSchema = z.object({
  id: z.string().trim().min(1).max(64),
  labelAr: z.string().trim().min(1).max(60),
  labelEn: z.string().trim().min(1).max(60),
  color: z.string().trim().max(24).default('#007aff'),
  floorIds: z.array(z.string()).max(12).default([]),
});

const propSchema = z.object({
  id: z.string().trim().min(1).max(64),
  floorId: z.string().trim().min(1).max(64),
  roomId: z.string().trim().max(64).optional(),
  prefabId: z.string().trim().min(1).max(64),
  category: z.enum(['furniture', 'nature', 'facilities', 'shapes', 'external', 'pins']).default('furniture'),
  x: z.number().min(-200).max(200),
  y: z.number().min(-20).max(60).default(0),
  z: z.number().min(-200).max(200),
  rotationY: z.number().min(-Math.PI * 2).max(Math.PI * 2).default(0),
  scale: z.number().min(0.2).max(10).default(1),
  scaleX: z.number().min(0.2).max(20).optional(),
  scaleY: z.number().min(0.2).max(20).optional(),
  scaleZ: z.number().min(0.2).max(20).optional(),
  colorTint: z.string().trim().max(24).optional(),
  modelUrl: z.string().trim().max(500).optional(),
});

const layoutPayloadSchema = z.object({
  meta: z.object({
    version: z.number().int().min(1).default(1),
    gridSize: z.number().min(0.1).max(5).default(0.5),
    unit: z.string().default('m'),
    theme: z.string().default('apple-clay'),
    publishedAt: z.string().optional(),
  }),
  floors: z.array(floorSchema).min(1).max(10),
  wings: z.array(wingSchema).min(1).max(24),
  rooms: z.array(roomSchema).max(160),
  props: z.array(propSchema).max(800),
});

module.exports = { layoutPayloadSchema };
