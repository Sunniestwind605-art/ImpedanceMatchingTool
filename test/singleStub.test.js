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

test("Question 2 GSM900 series-capacitor load matches the Smith-chart design", () => {
  const frequency = 925e6;
  const capacitance = 5e-12;
  const load = complex(100, -1 / (2 * Math.PI * frequency * capacitance));
  const result = calculateSingleStub(load, 50);
  const [shortest] = result.solutions;

  // The photographed Smith-chart reading (0.126λ, 0.138λ) is approximate;
  // compare the calculator with the precise transmission-line solution.
  assertClose(shortest.distanceWavelengths, 0.12723941548798, 1e-11);
  assertClose(shortest.shortedStubLengthWavelengths, 0.13710416138219, 1e-11);
  assertComplexClose(evaluateSingleStub(load, 50, shortest), complex(50), 1e-9);
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
