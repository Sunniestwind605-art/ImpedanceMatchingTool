import assert from "node:assert/strict";
import test from "node:test";
import * as api from "../src/index.js";

test("public API exports every calculator and SVG renderer", () => {
  for (const name of [
    "calculateLNetwork",
    "calculateSingleStub",
    "calculateLossySingleStub",
    "calculateDoubleStub",
    "calculateQuarterWave",
    "renderLNetworkSvg",
    "renderSingleStubSvg",
    "renderDoubleStubSvg",
    "renderQuarterWaveSvg",
  ]) {
    assert.equal(typeof api[name], "function", `${name} is not publicly exported`);
  }
});

