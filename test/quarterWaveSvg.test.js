import assert from "node:assert/strict";
import test from "node:test";
import { complex } from "../src/core/complex.js";
import { calculateQuarterWave } from "../src/calculators/quarterWave.js";
import { renderQuarterWaveSvg } from "../src/renderers/quarterWaveSvg.js";

test("quarter-wave renderer produces an accessible SVG for every placement", () => {
  for (const load of [complex(100), complex(100, -50), complex(50)]) {
    const result = calculateQuarterWave(load, 50);
    for (let index = 0; index < result.solutions.length; index += 1) {
      const svg = renderQuarterWaveSvg(result, index);
      assert.match(svg, /^<svg /);
      assert.match(svg, /role="img"/);
      assert.match(svg, /Quarter-wave match/);
      assert.match(svg, /Zₜ =/);
      assert.match(svg, /ℓ = 0\.250000λ/);
      assert.match(svg, /<\/svg>$/);
    }
  }
});

test("quarter-wave renderer rejects an unavailable placement", () => {
  const result = calculateQuarterWave(complex(100), 50);
  assert.throws(() => renderQuarterWaveSvg(result, 99), /No quarter-wave solution/);
});
