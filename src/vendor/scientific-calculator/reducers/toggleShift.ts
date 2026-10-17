import type { CalcState } from "../types";

function toggleShift(calc: CalcState) {
  calc.isShiftEnabled = !calc.isShiftEnabled;
}

export default toggleShift;
