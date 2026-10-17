import type { CalcState } from "../types";
import { FRACTION_BAR } from "../constants";

function backspace(calc: CalcState) {
  if (shouldAbort(calc)) return;
   
  const backspaceFunc = calc.numericMode === "fraction"
    ? backspaceFraction
    : backspaceDecimal;

  backspaceFunc(calc);
}

function shouldAbort(calc: CalcState): boolean {
  if (calc.currentOperand === "0" && calc.numericMode === "decimal") return true;
  return (
    !"0123456789.".includes(calc.lastInput!) &&
    !["frac", "+/-"].includes(calc.lastInput!)
  );
}

function backspaceFraction(calc: CalcState): void {
  backspaceCurrentOperand(calc);

  if (isZeroOrEmpty(calc.lastOperand!)) {
    const currentOperand = getLastElement(calc.fractionInputs).toString();
    updateCurrentOperand(currentOperand, calc);
    removeLastFractionInput(calc);

    if (calc.fractionInputs.length === 0) {
      calc.numericMode = "decimal";
    }
  }

  calc.output = [...calc.fractionInputs, calc.currentOperand].join(FRACTION_BAR);
}

function backspaceDecimal(calc: CalcState): void {
  backspaceCurrentOperand(calc);

  if (calc.currentOperand === "-") {
    calc.currentOperand = "0";
  }

  calc.output = calc.currentOperand !== ""
    ? calc.currentOperand
    : "0";
}

function backspaceCurrentOperand(calc: CalcState): void {
  const currentOperand = calc.currentOperand.substring(0, calc.currentOperand.length - 1);
  updateCurrentOperand(currentOperand, calc);
}

function updateCurrentOperand(newValue: string, calc: CalcState): void {
  calc.lastOperand = calc.currentOperand;
  calc.currentOperand = newValue;
}

function removeLastFractionInput(calc: CalcState): void {
  calc.fractionInputs.splice(calc.fractionInputs.length - 1, 1);
}

function isZeroOrEmpty(operand: string): boolean {
  return operand === "0" || operand === "";
}

function getLastElement<T>(arr: T[]) {
  return arr.slice(-1);
}

export default backspace;
