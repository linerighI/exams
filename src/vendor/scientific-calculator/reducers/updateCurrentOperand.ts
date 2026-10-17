import type { PayloadAction } from "@reduxjs/toolkit";
import type { CalcState, UpdateCurrentOperandPayload } from "../types";

import getDigitCount from "../utils/getDigitCount";
import { MAX_DIGITS } from "../constants";

function updateCurrentOperand(calc: CalcState, action: PayloadAction<UpdateCurrentOperandPayload>) {
  const { input } = action.payload;

  if (shouldAbort(input, calc)) return;

  calc.currentOperand = resolveOperand(input, calc);
  calc.output = resolveOutput(input, calc);
  calc.lastInput = input;
  calc.isHyperbolic = false;
}

function shouldAbort(input: string, calc: CalcState) {
  return isMaxLength(calc) || (input === "." && calc.currentOperand.includes("."));
}

function isMaxLength(calc: CalcState): boolean {
  if (calc.numericMode === "decimal") {
    return getDigitCount(calc.currentOperand) === MAX_DIGITS;
  }

  if (calc.numericMode === "fraction") {
    const len1 = calc
      .fractionInputs
      .reduce((acc, val) => 
        acc + getDigitCount(val.toString() + 1), 0);

    const len2 = getDigitCount(calc.currentOperand);
    return len1 + len2 === MAX_DIGITS;
  }

  return false;
}

function resolveOperand(input: string, calc: CalcState): string {
  if (isFirstDigit(input, calc) || lastInputWasSexagesimal(calc)) {
    return input;
  }
 
  return `${calc.currentOperand}${input}`;
}

function lastInputWasSexagesimal(calc: CalcState): boolean {
  return calc.lastInput === "sex";
}

function resolveOutput(input: string, calc: CalcState): string {
  return calc.numericMode === "decimal"
    ? calc.currentOperand
    : `${calc.output}${input}`;
}

function isFirstDigit(input: string, calc: CalcState) {
  return calc.currentOperand === "0" && 
    input !== "." || 
    calc.lastInput === "=" ||
    isFunction(calc.lastInput)
}

function isFunction(input: string | undefined): boolean {
  return input !== undefined &&
    input !== "." && 
    input !== "+/-" &&
    isNaN(Number(input));
}

export default updateCurrentOperand;
