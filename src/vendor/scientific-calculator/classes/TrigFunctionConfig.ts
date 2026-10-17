import type { TrigFunctionType } from "../types";

export  interface TrigFunction {
  func: TrigFunctionType;
  aria: string;
}

class TrigFunctionConfig {

  private static _instance: TrigFunctionConfig;

  private config: { [key: string]: TrigFunction };

  static get instance(): TrigFunctionConfig {
    if (!this._instance) {
      this._instance = new TrigFunctionConfig();
    }
    return this._instance;
  }

  private constructor() {
    this.config = {
      "!SHIFT !HYP sin": { func: "sin", aria: "sine" },
      ":SHIFT !HYP sin": { func: "asin", aria: "arc sine" },
      "!SHIFT :HYP sin": { func: "sinh", aria: "hyperbolic sine" },
      ":SHIFT :HYP sin": { func: "asinh", aria: "area hyperbolic sine" },
        
      "!SHIFT !HYP cos": { func: "cos", aria: "cosine" },
      ":SHIFT !HYP cos": { func: "acos", aria: "arc cosine" },
      "!SHIFT :HYP cos": { func: "cosh", aria: "hyperbolic cosine" },
      ":SHIFT :HYP cos": { func: "acosh", aria: "area hyperbolic cosine" },
    
      "!SHIFT !HYP tan": { func: "tan", aria: "tangent" },
      ":SHIFT !HYP tan": { func: "atan", aria: "arc tangent" },
      "!SHIFT :HYP tan": { func: "tanh", aria: "hyperbolic tangent" },
      ":SHIFT :HYP tan": { func: "atanh", aria: "area hyperbolic tangent" },
    };
  }
  
  get(
    trigFunc: "sin" | "cos" | "tan", 
    isShiftEnabled: boolean, 
    isHyperbolic: boolean): TrigFunction
  {
    const key = this.getTrigKey(trigFunc, isShiftEnabled, isHyperbolic);
    return this.config[key];
  }

  private getTrigKey(
    trigFunc: "sin" | "cos" | "tan", 
    isShiftEnabled: boolean, 
    isHyperbolic: boolean): string
  {
    const shift = isShiftEnabled ? ":SHIFT" : "!SHIFT";
    const hyp = isHyperbolic ? ":HYP" : "!HYP";
    return `${shift} ${hyp} ${trigFunc}`;
  }
}

export default TrigFunctionConfig;
