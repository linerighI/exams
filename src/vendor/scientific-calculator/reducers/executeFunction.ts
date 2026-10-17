import type { PayloadAction } from "@reduxjs/toolkit";
import type { CalcState, ExecuteFunctionPayload, FunctionType, OperandAffixes } from "../types";

import ExpressionBuilder from "../classes/ExpressionBuilder";
import ExpressionParser from "../classes/ExpressionParser";
import evaluate from "../utils/evaluate";
import formatNumber from "../utils/formatNumber";

import { convertFromRadians } from "../utils/convertFromRadians";
import { isArc, isAreaHyperbolic, isTrigonometric } from "../utils/isTrigonometric";
import { MAX_DIGITS } from "../constants";

function executeFunction(calc: CalcState, action: PayloadAction<ExecuteFunctionPayload>) {
  const { func } = action.payload;
  const expression = ExpressionBuilder.build(func, calc.currentOperand, calc.angleMode);
  let result = evaluate([expression]);
  
  if (isArc(func) || isAreaHyperbolic(func)) {
    result = convertFromRadians(result, calc.angleMode);
  }
      
  calc.currentOperand = result.toString();
  calc.output = formatNumber(result, MAX_DIGITS);
  calc.lastOperand = result.toString();
  calc.isHyperbolic = false;
  calc.repeatOperationAffixes = getRepeatOperationAffixes(calc, func, result);
  calc.lastInput = func;
}

function getRepeatOperationAffixes(calc: CalcState, func: FunctionType, result: number): OperandAffixes {
  const parser = new ExpressionParser([...calc.expression, result.toString()]);
  const { prefix, suffix } = parser.getRepeatOperationAffixes();
  
  if (prefix + suffix !== "") {
    return { prefix, suffix };
  }

  return (isTrigonometric(func))
    ? { prefix: "",  suffix: "" }
    : { prefix: `${func}(`, suffix: `)` };
}

export default executeFunction;
