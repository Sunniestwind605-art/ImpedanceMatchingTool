import assert from "node:assert/strict";
import test from "node:test";
import { complex } from "../src/core/complex.js";
import { calculateDoubleStub } from "../src/calculators/doubleStub.js";
import { renderDoubleStubSvg } from "../src/renderers/doubleStubSvg.js";

test("double-stub renderer produces accessible SVGs for all termination combinations", () => {
  const result = calculateDoubleStub(complex(100, -50), 50, 0.125);
  for (let index = 0; index < result.solutions.length; index += 1) {
    for (const firstTermination of ["open", "short"]) {
      for (const secondTermination of ["open", "short"]) {
        const svg = renderDoubleStubSvg(result, index, { firstTermination, secondTermination });
        assert.match(svg, /^<svg /);
        assert.match(svg, /role="img"/);
        assert.match(svg, /Double-stub shunt match/);
        assert.match(svg, /b₁ =/);
        assert.match(svg, /b₂ =/);
        assert.match(svg, /<\/svg>$/);
      }
    }
  }
});

test("double-stub renderer explains a forbidden-region result", () => {
  const result = calculateDoubleStub(complex(10), 50, 0.125);
  const svg = renderDoubleStubSvg(result);
  assert.match(svg, /No realizable match/);
  assert.match(svg, /forbidden region/);
});

test("double-stub renderer validates selections", () => {
  const result = calculateDoubleStub(complex(100, -50), 50, 0.125);
  assert.throws(() => renderDoubleStubSvg(result, 99), /No double-stub solution/);
  assert.throws(
    () => renderDoubleStubSvg(result, 0, { firstTermination: "resistive" }),
    /stub terminations must be/,
  );
});
