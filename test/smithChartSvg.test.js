import assert from "node:assert/strict";
import test from "node:test";
import { calculateSingleStub } from "../src/calculators/singleStub.js";
import { complex } from "../src/core/complex.js";
import { renderSmithChartSvg } from "../src/renderers/smithChartSvg.js";

test("Smith chart renders a labeled full grid, dim VSWR circle, and animated solution path", () => {
  const result = calculateSingleStub(complex(100, -50), 50);
  const svg = renderSmithChartSvg(result, "single-stub", 0);

  assert.match(svg, /viewBox="0 0 640 640"/);
  assert.match(svg, /class="smith-grid-label resistance-label"[^>]*>0\.2<\/text>/);
  assert.match(svg, /class="smith-grid-label resistance-label"[^>]*>10<\/text>/);
  assert.match(svg, /class="smith-grid-label reactance-label"[^>]*>5<\/text>/);
  assert.match(svg, /class="smith-vswr-reference"/);
  assert.match(svg, /class="smith-trace trace-0"/);
  assert.match(svg, /Starting load point/);
  assert.match(svg, /Matched endpoint/);
  assert.match(svg, /VSWR 2\.62:1/);
});

