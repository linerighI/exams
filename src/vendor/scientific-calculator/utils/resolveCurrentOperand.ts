import type { Draft } from "@reduxjs/toolkit";
import type { CalcState } from "../types";

import Fraction from "../classes/Fraction";
import isOperator from "./isOperator";

function resolveCurrentOperand(calc: CalcState): string {

  if (calc.numericMode === "fraction" && calc.fractionInputs.length > 0) {
    return Fraction
      .fromNumberArray(calc.fractionInputs)
      .toDecimal()
      .toString();
  }

  return isOperator(calc.lastInput)
    ? calc.lastOperand!
    : calc.currentOperand;
}

export default resolveCurrentOperand;
