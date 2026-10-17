import type { CalcState } from "../types";

function clear(calc: CalcState) {
  calc.numericMode = "decimal";
  calc.currentOperand = "0";
  calc.output = "0";
  calc.lastInput = undefined;
  calc.lastOperand = undefined;
  calc.repeatOperationAffixes = undefined;
  calc.isShiftEnabled = false;
  calc.isHyperbolic = false;
  calc.fractionInputs = [];
  calc.sexagesimalInputs = [];
}

export default clear;
