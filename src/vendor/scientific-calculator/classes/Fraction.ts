import { fraction } from "mathjs";
import { FRACTION_BAR } from "../constants";

class Fraction {
  sign: number;
  numerator: number;
  denominator: number;

  constructor(sign: number, numerator: number, denominator: number) {
    this.sign = sign;
    this.numerator = numerator;
    this.denominator = denominator;
  }

  static fromDecimal(decimal: number): Fraction {
    const f = fraction(decimal);
    return new Fraction(Number(f.s), Number(f.n), Number(f.d));
  }

  static fromNumberArray(arr: number[]) {
    switch (arr.length) {
      case 2: return Fraction.fromDecimal(arr[0] / arr[1]);
      case 3:
        const integerPart = arr[0];
        const fractionalPart = arr[1] / arr[2];
        return Fraction.fromDecimal(integerPart + fractionalPart);
      default:
          throw Error("Invalid array length");
    }
  }

  toDecimal(): number {
    return this.sign * this.numerator / this.denominator;
  }

  format(useMixed: boolean = true): string {
    const strSign = this.sign < 0 ? "-" : "";
    if (
      useMixed && 
      this.denominator > 1 && 
      this.numerator > this.denominator
    ) {
      const quotient = Math.floor(this.numerator / this.denominator);
      const remainder = this.numerator % this.denominator;
      const strSign = quotient < 0 ? "-" : "";
      return `${strSign}${quotient}${FRACTION_BAR}${remainder}${FRACTION_BAR}${this.denominator}`;
    } else {
      return `${strSign}${this.numerator}${FRACTION_BAR}${this.denominator}`
    }
  }
}

export default Fraction;
