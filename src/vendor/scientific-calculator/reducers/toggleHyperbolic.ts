import type { CalcState } from "../types";

function toggleHyperbolic(calc: CalcState) {
  calc.isHyperbolic = !calc.isHyperbolic;
}

export default toggleHyperbolic;
