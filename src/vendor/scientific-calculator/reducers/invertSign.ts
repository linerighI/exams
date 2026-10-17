import type { CalcState } from "../types";

function invertSign(calc: CalcState) {
  if (calc.lastInput === "=" && calc.output === "Error") return;
  
  calc.currentOperand = invert(calc.currentOperand);

  if (isNegativeFractionPart(calc)) {
    invertFirstFunctionInput(calc);
    calc.currentOperand = invert(calc.currentOperand)
  }

  calc.output = invert(calc.output);
  calc.lastInput = "+/-";
  calc.isHyperbolic = false;
}

function invert(strNumber: string): string {
  return strNumber.startsWith("-")
    ? strNumber.replace("-", "")
    : `-${strNumber}`;
}

function invertFirstFunctionInput(calc: CalcState): void {
  calc.fractionInputs[0] = calc.fractionInputs[0] * -1;
}

function isNegativeFractionPart(calc: CalcState): boolean {
  return calc.numericMode === "fraction" && calc.currentOperand.startsWith("-");
}

export default invertSign;
