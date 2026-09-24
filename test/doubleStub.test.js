import assert from "node:assert/strict";
import test from "node:test";
import { add, complex, magnitude, reciprocal } from "../src/core/complex.js";
import { calculateDoubleStub, evaluateDoubleStub } from "../src/calculators/doubleStub.js";
import {
  normalizeImpedance,
  reflectionCoefficient,
  transformNormalizedAdmittance,
} from "../src/core/transmissionLine.js";
import { assertClose, assertComplexClose } from "./helpers.js";

test("double-stub ground truth for 100-j50 ohms with one-eighth-wave spacing", () => {
  const result = calculateDoubleStub(complex(100, -50), 50, 0.125);
  assert.equal(result.matchable, true);
  assert.equal(result.solutions.length, 2);

  const byFirstStub = result.solutions.toSorted(
    (left, right) => left.firstStubSusceptance - right.firstStubSusceptance,
  );
  assertClose(byFirstStub[0].firstStubSusceptance, 0, 1e-10);
  assertClose(byFirstStub[0].secondStubSusceptance, -1, 1e-10);
  assertClose(byFirstStub[1].firstStubSusceptance, 1.6, 1e-10);
  assertClose(byFirstStub[1].secondStubSusceptance, 3, 1e-10);
});

test("every matchable double-stub solution reaches the chart center", () => {
  const vectors = [
    { load: complex(100, -50), z0: 50, spacing: 0.125, offset: 0 },
    { load: complex(30, 20), z0: 50, spacing: 0.125, offset: 0 },
    { load: complex(80, 65), z0: 75, spacing: 0.075, offset: 0.03 },
    { load: complex(12, -90), z0: 50, spacing: 0.16, offset: 0.08 },
  ];

  for (const { load, z0, spacing, offset } of vectors) {
    const result = calculateDoubleStub(load, z0, spacing, offset);
    assert.equal(result.matchable, true, result.reason);
    assert.ok(result.solutions.length >= 1);

    for (const solution of result.solutions) {
      assertComplexClose(
        evaluateDoubleStub(load, z0, result, solution),
        complex(z0),
        1e-8,
        "double-stub solution failed to match",
      );

      const yLoad = reciprocal(normalizeImpedance(load, z0));
      const yAtFirst = transformNormalizedAdmittance(yLoad, offset);
      const yAfterFirst = add(yAtFirst, complex(0, solution.firstStubSusceptance));
      const yAtSecond = transformNormalizedAdmittance(yAfterFirst, spacing);
      assertClose(yAtSecond.re, 1, 1e-9, "second-stub conductance is not unity");
      assertClose(
        magnitude(reflectionCoefficient(reciprocal(yAtSecond))),
        magnitude(reflectionCoefficient(reciprocal(yAfterFirst))),
        1e-9,
        "between-stub movement left its VSWR circle",
      );
    }
  }
});

test("double-stub reports the forbidden region without fabricating a solution", () => {
  const result = calculateDoubleStub(complex(10), 50, 0.125);
  assert.equal(result.matchable, false);
  assert.deepEqual(result.solutions, []);
  assert.match(result.reason, /forbidden region/);
});

test("double-stub rejects degenerate quarter-wave spacing", () => {
  assert.throws(
    () => calculateDoubleStub(complex(100, -50), 50, 0.25),
    /must not be a multiple of a quarter wavelength/,
  );
});
