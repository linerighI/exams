import type { CalcState } from "../types";

import ExpressionParser from "../classes/ExpressionParser";
import evaluate from "../utils/evaluate";
import formatNumber from "../utils/formatNumber";
import { MAX_DIGITS } from "../constants";

function percent(calc: CalcState) {
  if (calc.lastInput === "=" && calc.output === "Error") return;

  const expression = [...calc.expression, calc.currentOperand,  "%"];
  const result = evaluate(expression);
  const formattedResult = formatNumber(result, MAX_DIGITS);
  const parser = new ExpressionParser(expression);

  calc.currentOperand = formattedResult;
  calc.output = formattedResult;
  calc.expression = [];
  calc.repeatOperationAffixes = parser.getRepeatOperationAffixes();
  calc.isHyperbolic = false;
  calc.lastInput =  "%";
}

export default percent;
