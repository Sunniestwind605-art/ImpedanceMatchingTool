import test from "node:test";
import { complex, magnitude, reciprocal } from "../src/core/complex.js";
import {
  impedanceFromReflection,
  reflectionCoefficient,
  transformNormalizedImpedance,
} from "../src/core/transmissionLine.js";
import { assertClose, assertComplexClose } from "./helpers.js";

test("reflection conversion round-trips normalized impedance", () => {
  const impedance = complex(0.7, 1.2);
  assertComplexClose(impedanceFromReflection(reflectionCoefficient(impedance)), impedance);
});

test("lossless line movement preserves Smith-chart radius", () => {
  const load = complex(2, -1);
  const initialRadius = magnitude(reflectionCoefficient(load));
  for (const distance of [0, 0.03125, 0.125, 0.249, 0.375, 0.499]) {
    const transformed = transformNormalizedImpedance(load, distance);
    assertClose(
      magnitude(reflectionCoefficient(transformed)),
      initialRadius,
      1e-10,
      `VSWR radius changed at ${distance} wavelengths`,
    );
  }
});

test("a quarter-wave line performs normalized impedance inversion", () => {
  const load = complex(2, -0.5);
  assertComplexClose(transformNormalizedImpedance(load, 0.25), reciprocal(load), 1e-10);
});
