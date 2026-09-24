import assert from "node:assert/strict";
import test from "node:test";
import { complex, magnitude } from "../src/core/complex.js";
import { calculateQuarterWave, evaluateQuarterWave } from "../src/calculators/quarterWave.js";
import {
  normalizeImpedance,
  reflectionCoefficient,
  transformNormalizedImpedance,
} from "../src/core/transmissionLine.js";
import { assertClose, assertComplexClose } from "./helpers.js";

test("quarter-wave ground truth: 100 ohms matches 50 ohms with a 70.7107-ohm section", () => {
  const result = calculateQuarterWave(complex(100), 50);
  assert.equal(result.required, true);
  assert.equal(result.solutions.length, 1);
  assertClose(result.solutions[0].placementDistanceWavelengths, 0);
  assertClose(result.solutions[0].transformerLengthWavelengths, 0.25);
  assertClose(result.solutions[0].terminationResistanceOhms, 100);
  assertClose(result.solutions[0].transformerImpedanceOhms, Math.sqrt(5000));
});

test("quarter-wave ground truth: complex load yields the two real-axis placements", () => {
  const result = calculateQuarterWave(complex(100, -50), 50);
  assert.equal(result.solutions.length, 2);
  const [lowResistance, highResistance] = result.solutions;

  assertClose(lowResistance.placementDistanceWavelengths, 0.21310409558739, 1e-10);
  assertClose(lowResistance.terminationResistanceOhms, 19.0983005625053, 1e-10);
  assertClose(lowResistance.transformerImpedanceOhms, 30.9016994374947, 1e-10);

  assertClose(highResistance.placementDistanceWavelengths, 0.46310409558739, 1e-10);
  assertClose(highResistance.terminationResistanceOhms, 130.901699437495, 1e-10);
  assertClose(highResistance.transformerImpedanceOhms, 80.9016994374947, 1e-10);
});

test("every quarter-wave solution matches and its placement stays on the load VSWR circle", () => {
  const vectors = [
    { load: complex(100), z0: 50 },
    { load: complex(100, -50), z0: 50 },
    { load: complex(30, 20), z0: 50 },
    { load: complex(80, 65), z0: 75 },
    { load: complex(12, -90), z0: 50 },
  ];

  for (const { load, z0 } of vectors) {
    const result = calculateQuarterWave(load, z0);
    const normalizedLoad = normalizeImpedance(load, z0);
    const initialRadius = magnitude(reflectionCoefficient(normalizedLoad));
    for (const solution of result.solutions) {
      assertComplexClose(
        evaluateQuarterWave(load, z0, solution),
        complex(z0),
        1e-8,
        "quarter-wave solution failed to match",
      );
      const moved = transformNormalizedImpedance(
        normalizedLoad,
        solution.placementDistanceWavelengths,
      );
      assertClose(moved.im, 0, 1e-9, "transformer termination is not real");
      assertClose(
        magnitude(reflectionCoefficient(moved)),
        initialRadius,
        1e-9,
        "placement move left the load VSWR circle",
      );
    }
  }
});

test("an already matched load reports that no transformer is required", () => {
  const result = calculateQuarterWave(complex(50), 50);
  assert.equal(result.required, false);
  assert.equal(result.solutions.length, 1);
  assert.equal(result.solutions[0].transformerImpedanceOhms, 50);
  assertComplexClose(evaluateQuarterWave(complex(50), 50, result.solutions[0]), complex(50));
});
