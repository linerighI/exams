/**
 * Pure deterministic math calculating classroom crowd indicator figures (0..5 max)
 * proportional to student attendance/absence percentage and room formation slots.
 */

export interface StudentPresenceStats {
  count: 0 | 1 | 2 | 3 | 4 | 5;
  totalStudents: number;
  absentCount: number;
  presentCount: number;
  absencePct: number;
}

/**
 * Compute how many faded black silhouette figures (0..5) represent a classroom.
 * Defaults to 5 figures before absences occur; drops proportionally as absence rises.
 */
export function computeStudentFigures(
  totalStudents: number,
  absentCount: number,
): StudentPresenceStats {
  if (totalStudents <= 0) {
    return { count: 0, totalStudents: 0, absentCount: 0, presentCount: 0, absencePct: 0 };
  }
  const safeAbsent = Math.max(0, Math.min(totalStudents, absentCount));
  const presentCount = totalStudents - safeAbsent;
  const absencePct = Math.round((safeAbsent / totalStudents) * 100);
  if (presentCount <= 0) {
    return { count: 0, totalStudents, absentCount: safeAbsent, presentCount: 0, absencePct };
  }
  const rawCount = Math.round((presentCount / totalStudents) * 5);
  const count = Math.max(1, Math.min(5, rawCount)) as 1 | 2 | 3 | 4 | 5;
  return { count, totalStudents, absentCount: safeAbsent, presentCount, absencePct };
}

/** Compute staggered architectural world-XZ positions for up to 5 classroom figures. */
export function computeFigureFormation(
  count: number,
  roomX: number,
  roomZ: number,
  roomWidth: number,
  roomDepth: number,
  elevationY: number,
): [number, number, number][] {
  if (count <= 0) return [];
  const usableW = Math.max(1.2, Math.min(3.6, roomWidth * 0.48));
  const usableD = Math.max(1.0, Math.min(2.4, roomDepth * 0.36));

  const frontSlots: [number, number][] =
    count === 1
      ? [[0, 0]]
      : count === 2
        ? [[-usableW * 0.28, 0], [usableW * 0.28, 0]]
        : [[-usableW * 0.42, usableD * 0.35], [0, usableD * 0.35], [usableW * 0.42, usableD * 0.35]];

  const backSlots: [number, number][] =
    count <= 3
      ? []
      : count === 4
        ? [[0, -usableD * 0.35]]
        : [[-usableW * 0.28, -usableD * 0.35], [usableW * 0.28, -usableD * 0.35]];

  return [...frontSlots, ...backSlots]
    .slice(0, count)
    .map(([dx, dz]) => [roomX + dx, elevationY + 0.14, roomZ + dz]);
}
