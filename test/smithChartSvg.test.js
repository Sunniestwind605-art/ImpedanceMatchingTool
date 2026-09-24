import assert from "node:assert/strict";
import test from "node:test";
import { calculateLossySingleStub } from "../src/calculators/lossySingleStub.js";
import { calculateSingleStub } from "../src/calculators/singleStub.js";
import { complex } from "../src/core/complex.js";
import { renderSmithChartSvg } from "../src/renderers/smithChartSvg.js";

test("expanded Smith chart renders a labeled full grid, dim VSWR circle, and animated solution path", () => {
  const result = calculateSingleStub(complex(100, -50), 50);
  const svg = renderSmithChartSvg(result, "single-stub", 0, { detail: "full" });

  assert.match(svg, /viewBox="0 0 640 640"/);
  assert.match(svg, /class="smith-grid-label resistance-label"[^>]*>0\.2<\/text>/);
  assert.match(svg, /class="smith-grid-label resistance-label"[^>]*>10<\/text>/);
  assert.match(svg, /class="smith-grid-label reactance-label"[^>]*>5<\/text>/);
  assert.match(svg, /class="smith-vswr-reference"/);
  assert.match(svg, /stroke-dasharray:3000/);
  assert.match(svg, /class="smith-trace trace-0"/);
  assert.match(svg, /Starting load point/);
  assert.match(svg, /Matched endpoint/);
  assert.match(svg, /VSWR 2\.62:1/);
  assert.ok((svg.match(/class="smith-grid"/g) ?? []).length >= 38);
});

test("compact Smith chart keeps detailed grid labels for the expanded view", () => {
  const result = calculateSingleStub(complex(100, -50), 50);
  const svg = renderSmithChartSvg(result, "single-stub", 0);

  assert.match(svg, /class="smith-grid-compact"/);
  assert.doesNotMatch(svg, /class="smith-grid-label (?:resistance|reactance)-label"/);
  assert.ok((svg.match(/class="smith-grid"/g) ?? []).length < 15);
  assert.match(svg, /class="smith-trace trace-0"/);
});

test("lossy single-stub route spirals through the chart before reaching match", () => {
  const result = calculateLossySingleStub(complex(100, -50), 50, 0.2, "short");
  const svg = renderSmithChartSvg(result, "lossy-single-stub", 0, { detail: "full" });

  assert.match(svg, /Load → lossy stub position/);
  assert.match(svg, /Lossy stub → match/);
  assert.match(svg, /class="smith-trace trace-1"/);
});
