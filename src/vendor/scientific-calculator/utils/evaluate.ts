import { 
  addDependencies,
  acosDependencies,
  acoshDependencies,
  asinDependencies,
  asinhDependencies,
  atanDependencies,
  atanhDependencies,
  cbrtDependencies,
  cosDependencies,
  coshDependencies,
  create,
  cubeDependencies,
  divideDependencies,
  evaluateDependencies,
  expDependencies,
  factory,
  logDependencies,
  log10Dependencies,
  multiplyDependencies,
  sinDependencies,
  sinhDependencies,
  sqrtDependencies,
  squareDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
} from "mathjs";

type OperationFunction = (...args: number[]) => number;
const createOperation = (name: string, fn: OperationFunction) => factory(name, [], () => fn);
const powerOfTen = (exponent: number) => Math.pow(10, exponent);

const { evaluate } = create({
  addDependencies,
  acosDependencies,
  acoshDependencies,
  asinDependencies,
  asinhDependencies,
  atanDependencies,
  atanhDependencies,
  cbrtDependencies,
  cosDependencies,
  coshDependencies,
  cubeDependencies,
  divideDependencies,
  evaluateDependencies,
  expDependencies,
  logDependencies,
  log10Dependencies,
  multiplyDependencies,
  sinDependencies,
  sinhDependencies,
  sqrtDependencies,
  squareDependencies,
  subtractDependencies,
  tanDependencies,
  tanhDependencies,
  createPowerOfTen: createOperation("powerOfTen", powerOfTen),
});

export default (expression: string[]): number => {
  return evaluate(expression.join(""));
}
