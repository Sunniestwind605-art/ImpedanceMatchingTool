import assert from "node:assert/strict";
import test from "node:test";
import { complex } from "../src/core/complex.js";
import { calculateLNetwork, evaluateLNetwork } from "../src/calculators/lNetwork.js";
import { assertClose, assertComplexClose } from "./helpers.js";

const FREQUENCY = 1e9;

test("L-network ground truth: 25 ohm load produces two series-then-shunt solutions", () => {
  const result = calculateLNetwork(complex(25), 50, FREQUENCY);
  const solutions = result.solutions.filter(({ topology }) => topology === "series-then-shunt");
  assert.equal(solutions.length, 2);

  assertClose(solutions[0].seriesReactanceOhms, 25);
  assertClose(solutions[0].shuntSusceptanceSiemens, 0.02);
  assert.equal(solutions[0].seriesComponent.kind, "inductor");
  assertClose(solutions[0].seriesComponent.value, 3.978873577297384e-9);
  assert.equal(solutions[0].shuntComponent.kind, "capacitor");
  assertClose(solutions[0].shuntComponent.value, 3.183098861837907e-12);

  assertClose(solutions[1].seriesReactanceOhms, -25);
  assertClose(solutions[1].shuntSusceptanceSiemens, -0.02);
});

test("L-network ground truth: 100 ohm load produces two shunt-then-series solutions", () => {
  const result = calculateLNetwork(complex(100), 50, FREQUENCY);
  const solutions = result.solutions.filter(({ topology }) => topology === "shunt-then-series");
  assert.equal(solutions.length, 2);

  assertClose(solutions[0].shuntSusceptanceSiemens, 0.01);
  assertClose(solutions[0].seriesReactanceOhms, 50);
  assertClose(solutions[1].shuntSusceptanceSiemens, -0.01);
  assertClose(solutions[1].seriesReactanceOhms, -50);
});

test("every L-network solution transforms representative complex loads to the source resistance", () => {
  const vectors = [
    { load: complex(25, 10), source: 50 },
    { load: complex(100, -30), source: 50 },
    { load: complex(37, 85), source: 75 },
    { load: complex(120, 60), source: 50 },
  ];

  for (const vector of vectors) {
    const result = calculateLNetwork(vector.load, vector.source, 915e6);
    assert.ok(result.solutions.length >= 2, "expected a realizable L-network pair");
    for (const solution of result.solutions) {
      assertComplexClose(
        evaluateLNetwork(vector.load, solution),
        complex(vector.source),
        1e-9,
        `${solution.topology} failed to match`,
      );
    }
  }
});

test("an already matched load returns a zero-element solution", () => {
  const result = calculateLNetwork(complex(50), 50, FREQUENCY);
  assert.equal(result.solutions.length, 1);
  assert.equal(result.solutions[0].topology, "matched");
  assert.equal(result.solutions[0].seriesComponent.kind, "none");
  assert.equal(result.solutions[0].shuntComponent.kind, "none");
});
