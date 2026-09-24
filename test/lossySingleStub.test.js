import assert from "node:assert/strict";
import test from "node:test";
import { calculateLossySingleStub, evaluateLossySingleStub } from "../src/calculators/lossySingleStub.js";
import { complex } from "../src/core/complex.js";
import { assertClose, assertComplexClose } from "./helpers.js";

test("lossy single-stub ground truth for both stub terminations", () => {
  const load = complex(100, -50);
  for (const termination of ["open", "short"]) {
    const result = calculateLossySingleStub(load, 50, 0.2, termination);
    assert.equal(result.termination, termination);
    assert.equal(result.solutions.length, 2);

    for (const solution of result.solutions) {
      assert.ok(solution.distanceWavelengths >= 0 && solution.distanceWavelengths < 0.5);
      assert.ok(solution.stubLengthWavelengths > 0 && solution.stubLengthWavelengths < 0.5);
      assert.ok(solution.matchingError < 1e-8);
      assertComplexClose(
        evaluateLossySingleStub(load, 50, 0.2, solution, termination),
        complex(50),
        1e-8,
        `${termination}-stub lossy match failed`,
      );
      if (termination === "open") {
        assertClose(solution.openStubLengthWavelengths, solution.stubLengthWavelengths, 1e-12);
        assert.equal(solution.shortedStubLengthWavelengths, null);
      } else {
        assertClose(solution.shortedStubLengthWavelengths, solution.stubLengthWavelengths, 1e-12);
        assert.equal(solution.openStubLengthWavelengths, null);
      }
    }
  }
});

test("zero attenuation reduces exactly to the lossless single-stub solutions", () => {
  const load = complex(100, -50);
  for (const termination of ["open", "short"]) {
    const result = calculateLossySingleStub(load, 50, 0, termination);
    const idealLengths = result.solutions.map((solution) => solution.stubLengthWavelengths);
    assertClose(idealLengths[0], termination === "open" ? 0.375 : 0.125, 1e-10);
    assertClose(idealLengths[1], termination === "open" ? 0.125 : 0.375, 1e-10);
    for (const solution of result.solutions) {
      assertComplexClose(
        evaluateLossySingleStub(load, 50, 0, solution, termination),
        complex(50),
        1e-9,
      );
    }
  }
});

test("lossy matches hold for loads with different complex impedances", () => {
  const vectors = [complex(30, 20), complex(80, 65), complex(12, -90)];
  for (const load of vectors) {
    for (const termination of ["open", "short"]) {
      const result = calculateLossySingleStub(load, 50, 0.5, termination);
      assert.ok(result.solutions.length > 0, `no ${termination} lossy match for ${load.re}+j${load.im}`);
      for (const solution of result.solutions) {
        assertComplexClose(
          evaluateLossySingleStub(load, 50, 0.5, solution, termination),
          complex(50),
          1e-8,
        );
      }
    }
  }
});

test("lossy single-stub validates attenuation and termination", () => {
  assert.throws(() => calculateLossySingleStub(complex(100), 50, -0.1), /attenuationDbPerWavelength/);
  assert.throws(() => calculateLossySingleStub(complex(100), 50, 100.1), /attenuationDbPerWavelength/);
  assert.throws(() => calculateLossySingleStub(complex(100), 50, 0.1, "resistive"), /termination/);
});
