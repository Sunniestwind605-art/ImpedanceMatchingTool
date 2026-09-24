import assert from "node:assert/strict";
import test from "node:test";
import { complex } from "../src/core/complex.js";
import { calculateSingleStub } from "../src/calculators/singleStub.js";
import { calculateLossySingleStub } from "../src/calculators/lossySingleStub.js";
import { renderSingleStubSvg } from "../src/renderers/singleStubSvg.js";

test("single-stub renderer produces accessible open and short SVGs for every solution", () => {
  const result = calculateSingleStub(complex(100, -50), 50);
  for (let index = 0; index < result.solutions.length; index += 1) {
    for (const termination of ["open", "short"]) {
      const svg = renderSingleStubSvg(result, index, termination);
      assert.match(svg, /^<svg /);
      assert.match(svg, /role="img"/);
      assert.match(svg, /Single-stub shunt match/);
      assert.match(svg, new RegExp(`${termination}-circuited stub`));
      assert.match(svg, /<\/svg>$/);
    }
  }
});

test("single-stub renderer validates solution and termination selections", () => {
  const result = calculateSingleStub(complex(100, -50), 50);
  assert.throws(() => renderSingleStubSvg(result, 99), /No single-stub solution/);
  assert.throws(() => renderSingleStubSvg(result, 0, "resistive"), /termination must be/);
});

test("single-stub renderer identifies lossy feed and stub lines", () => {
  const result = calculateLossySingleStub(complex(100, -50), 50, 0.2, "short");
  const svg = renderSingleStubSvg(result, 0, "short");
  assert.match(svg, /Lossy-line single-stub match/);
  assert.match(svg, /Lossy line/);
  assert.match(svg, /0\.200 dB\/λ/);
  assert.match(svg, /Ystub\/Z₀/);
});

