import type { AngleUnit, FunctionType } from "../types";
import { convertToRadians } from "../utils/convertToRadians";
import { isArc, isAreaHyperbolic, isHyperbolic, isTrigonometric } from "../utils/isTrigonometric";
 
class ExpressionBuilder {
  
  static build(func: FunctionType, operand: string, angleUnit: AngleUnit): string {
      let convertedOperand = operand;
    
      if (isTrigonometric(func)) {
        const isAngleOperand = !isArc(func) && !isAreaHyperbolic(func);
        if (isAngleOperand) {
          convertedOperand = convertToRadians(parseFloat(operand), angleUnit).toString();
        }
      }
    
      return `${func}(${convertedOperand})`;
  }
}
  
export default ExpressionBuilder;
