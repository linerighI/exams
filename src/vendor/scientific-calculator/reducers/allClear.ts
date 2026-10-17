import type { CalcState } from "../types";

function allClear(calc: CalcState) {
  calc.numericMode = "decimal";
  calc.angleMode = calc.angleMode;
  calc.expression = [];
  calc.currentOperand = "0";
  calc.output = "0";
  calc.voltageLevel = 1.0;
  calc.lastInput = undefined;
  calc.lastOperand = undefined;
  calc.repeatOperationAffixes = undefined;
  calc.isShiftEnabled = false;
  calc.isHyperbolic = false;
  calc.fractionInputs = [];
  calc.sexagesimalInputs = [];
  calc.isBracketOpen = false;
};

export default allClear;
