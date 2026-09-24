import assert from "node:assert/strict";
import test from "node:test";
import { complex } from "../src/core/complex.js";
import { calculateLNetwork } from "../src/calculators/lNetwork.js";
import { renderLNetworkSvg } from "../src/renderers/lNetworkSvg.js";

test("L-network renderer produces an accessible SVG for each topology", () => {
  for (const load of [complex(25, 10), complex(100, -30), complex(50)]) {
    const result = calculateLNetwork(load, 50, 1e9);
    for (let index = 0; index < result.solutions.length; index += 1) {
      const svg = renderLNetworkSvg(result, index);
      assert.match(svg, /^<svg /);
      assert.match(svg, /role="img"/);
      assert.match(svg, /L-network match/);
      assert.match(svg, new RegExp(result.solutions[index].topology));
      assert.match(svg, /<\/svg>$/);
    }
  }
});

test("L-network renderer rejects an unavailable solution index", () => {
  const result = calculateLNetwork(complex(25), 50, 1e9);
  assert.throws(() => renderLNetworkSvg(result, 99), /No L-network solution/);
});
