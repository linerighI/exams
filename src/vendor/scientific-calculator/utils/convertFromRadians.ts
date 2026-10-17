import type { AngleUnit } from "../types";

export function convertFromRadians(angle: number, unit: AngleUnit) {
  switch (unit) {
    case "deg": return angle * (180 / Math.PI);
    case "grad": return angle * (200 / Math.PI);
    default: return angle;
  }
}
