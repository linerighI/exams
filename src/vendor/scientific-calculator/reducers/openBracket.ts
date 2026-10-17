import type { CalcState } from "../types";

function openBracket(calc: CalcState) {
  calc.isBracketOpen = true;
  calc.expression.push("(");
  calc.currentOperand = "0";
  calc.output = "0";
  calc.lastInput = "(";
}

export default openBracket;
