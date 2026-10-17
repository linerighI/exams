import type { CalcState } from "../types";
import { ANGLE_MODES } from "../constants";

function cycleDrgMode(calc: CalcState) {
  const currentIndex = ANGLE_MODES.indexOf(calc.angleMode);
  const nextIndex = (currentIndex + 1) % ANGLE_MODES.length;
  calc.angleMode = ANGLE_MODES[nextIndex];
}

export default cycleDrgMode;
