import assert from "node:assert/strict";
import test from "node:test";
import { complex, magnitude, reciprocal } from "../src/core/complex.js";
import { calculateSingleStub, evaluateSingleStub } from "../src/calculators/singleStub.js";
import {
  normalizeImpedance,
  reflectionCoefficient,
  transformNormalizedAdmittance,
} from "../src/core/transmissionLine.js";
import { assertClose, assertComplexClose } from "./helpers.js";

test("single-stub ground truth for 100-j50 ohms on a 50-ohm line", () => {
  const load = complex(100, -50);
  const result = calculateSingleStub(load, 50);
  assert.equal(result.solutions.length, 2);

  const [near, far] = result.solutions;
  assertClose(near.distanceWavelengths, 0.125, 1e-10);
  assertClose(near.normalizedStubSusceptance, -1, 1e-10);
  assertClose(near.openStubLengthWavelengths, 0.375, 1e-10);
  assertClose(near.shortedStubLengthWavelengths, 0.125, 1e-10);

  assertClose(far.distanceWavelengths, 0.30120819117478, 1e-10);
  assertClose(far.normalizedStubSusceptance, 1, 1e-10);
  assertClose(far.openStubLengthWavelengths, 0.125, 1e-10);
  assertClose(far.shortedStubLengthWavelengths, 0.375, 1e-10);
});

test("every single-stub solution matches representative complex loads", () => {
  const vectors = [
    { load: complex(100, -50), z0: 50 },
    { load: complex(30, 20), z0: 50 },
    { load: complex(80, 65), z0: 75 },
    { load: complex(12, -90), z0: 50 },
  ];

  for (const { load, z0 } of vectors) {
    const result = calculateSingleStub(load, z0);
    assert.equal(result.solutions.length, 2);
    const initialGammaMagnitude = magnitude(
      reflectionCoefficient(normalizeImpedance(load, z0)),
    );

    for (const solution of result.solutions) {
      assertComplexClose(
        evaluateSingleStub(load, z0, solution),
        complex(z0),
        1e-9,
        "single-stub solution failed to match",
      );

      const movedAdmittance = transformNormalizedAdmittance(
        reciprocal(normalizeImpedance(load, z0)),
        solution.distanceWavelengths,
      );
      assertClose(movedAdmittance.re, 1, 1e-9, "stub point conductance is not unity");
      assertClose(
        magnitude(reflectionCoefficient(reciprocal(movedAdmittance))),
        initialGammaMagnitude,
        1e-9,
        "line movement left the load VSWR circle",
      );
    }
  }
});

test("single-stub handles the quarter-wave tangent root", () => {
  const load = complex(50, -50);
  const result = calculateSingleStub(load, 50);
  assert.ok(result.solutions.some(({ distanceWavelengths }) =>
    Math.abs(distanceWavelengths - 0.25) < 1e-10));
  for (const solution of result.solutions) {
    assertComplexClose(evaluateSingleStub(load, 50, solution), complex(50), 1e-8);
  }
});

test("an already matched line returns a no-movement, no-open-stub solution", () => {
  const result = calculateSingleStub(complex(50), 50);
  assert.equal(result.solutions.length, 1);
  assert.equal(result.solutions[0].distanceWavelengths, 0);
  assert.equal(result.solutions[0].normalizedStubSusceptance, 0);
  assert.equal(result.solutions[0].openStubLengthWavelengths, 0);
});
