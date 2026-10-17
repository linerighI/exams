import type { 
  GetLastOperatorResultType, 
  OperandAffixes, 
  OperatorType
} from "../types";

import isOperator from "../utils/isOperator";

class ExpressionParser {

  private readonly expression: string[];

  constructor(expression: string[] = []) {
    this.expression = expression;
  }

  getExpressionToEvaluate(newOperator: OperatorType): string[] | undefined {
    const { lastOperator, index: lastOperatorIndex } = this.getLastOperator();
    
    const lastOpenBracketIndex = this.expression.lastIndexOf("(");
    if (lastOperatorIndex < lastOpenBracketIndex) {
      return undefined;
    }

    const noOperatorFound = lastOperator === undefined;
    if (noOperatorFound) {
      const expressionIsANumber = this.isNumber(this.expression.join());
      return expressionIsANumber ? undefined : this.expression;
    }
  
    if (this.isDivideOrMultiply(newOperator) && this.isAddOrSubtract(lastOperator)) {
      return undefined;
    }
  
    return this.expression.slice(lastOperatorIndex - 1);
  }

  getLastBracketedExpression() {
    const startIndex = this.expression.lastIndexOf("(");
    return this.expression.slice(startIndex);
  }

  getRepeatOperationAffixes(): OperandAffixes {
    const { lastOperator, index: lastOperatorIndex } = this.getLastOperator();
    
    if (lastOperator) {
      return { 
        prefix: "",
        suffix: this.expression.slice(lastOperatorIndex).join(""),
      };
    }
   
    return {
      prefix: "",
      suffix: "",
    };
  }

  getLastOperator(): GetLastOperatorResultType {

    for (let i = this.expression.length - 1; i > -1; i--) {
      const expressionPart = this.expression[i];
      if (isOperator(expressionPart)) {
        return { 
          lastOperator: expressionPart as OperatorType,
          index: i
        };
      }
    }
    
    return { 
      lastOperator: undefined,
      index: -1
    };
  }

  isNumber(candidate: string): boolean {
    return !isNaN(Number(candidate));
  }

  isAddOrSubtract(operator: OperatorType): boolean {
    return "+-".indexOf(operator) > -1;
  }

  isDivideOrMultiply(operator: OperatorType): boolean {
    return "/*".indexOf(operator) > -1;
  }
}

export default ExpressionParser;
