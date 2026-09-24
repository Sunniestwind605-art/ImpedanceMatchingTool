import { formatEngineering, svgDocument } from "./svg.js";

function terminationMark(type, x) {
  return type === "open"
    ? `<path class="component" d="M ${x - 13} 224 V 246 M ${x + 13} 224 V 246"/>`
    : `<path class="component" d="M ${x - 20} 238 H ${x + 20}"/><path class="wire" d="M ${x - 14} 247 l 8 -9 M ${x - 2} 247 l 8 -9 M ${x + 10} 247 l 8 -9"/>`;
}

function lengthFor(solution, position, termination) {
  const suffix = termination === "open"
    ? "OpenStubLengthWavelengths"
    : "ShortedStubLengthWavelengths";
  return solution[`${position}${suffix}`];
}

export function renderDoubleStubSvg(
  result,
  solutionIndex = 0,
  { firstTermination = "short", secondTermination = "short" } = {},
) {
  for (const termination of [firstTermination, secondTermination]) {
    if (!new Set(["open", "short"]).has(termination)) {
      throw new RangeError('stub terminations must be "open" or "short"');
    }
  }

  if (!result.matchable) {
    return svgDocument(`<rect class="panel" x="10" y="10" width="740" height="260" rx="18"/>
  <text class="title" x="30" y="45">Double-stub shunt match</text>
  <path class="component" d="M 300 95 L 460 215 M 460 95 L 300 215"/>
  <text class="value" x="380" y="78" text-anchor="middle">No realizable match</text>
  <text class="label" x="380" y="246" text-anchor="middle">${result.reason}</text>`, {
      label: `Double-stub match unavailable: ${result.reason}`,
    });
  }

  const solution = result.solutions[solutionIndex];
  if (!solution) throw new RangeError(`No double-stub solution at index ${solutionIndex}`);
  const firstLength = lengthFor(solution, "first", firstTermination);
  const secondLength = lengthFor(solution, "second", secondTermination);

  return svgDocument(`<rect class="panel" x="10" y="10" width="740" height="260" rx="18"/>
  <text class="title" x="30" y="45">Double-stub shunt match</text>
  <text class="muted" x="730" y="43" text-anchor="end">spacing ${result.spacingWavelengths.toFixed(6)}λ</text>
  <rect class="panel" x="30" y="89" width="120" height="60" rx="10"/>
  <text class="label" x="90" y="116" text-anchor="middle">Matched port</text>
  <text class="value" x="90" y="138" text-anchor="middle">${formatEngineering(result.characteristicImpedance, "Ω")}</text>
  <path class="wire" d="M 150 119 H 620"/>
  <circle class="node" cx="285" cy="119" r="6"/><path class="wire" d="M 285 119 V 224"/>
  ${terminationMark(secondTermination, 285)}
  <text class="value" x="305" y="174">b₂ = ${solution.secondStubSusceptance.toFixed(6)}</text>
  <text class="muted" x="305" y="196">${secondTermination}, ℓ₂ = ${secondLength.toFixed(6)}λ</text>
  <circle class="node" cx="485" cy="119" r="6"/><path class="wire" d="M 485 119 V 224"/>
  ${terminationMark(firstTermination, 485)}
  <text class="value" x="505" y="174">b₁ = ${solution.firstStubSusceptance.toFixed(6)}</text>
  <text class="muted" x="505" y="196">${firstTermination}, ℓ₁ = ${firstLength.toFixed(6)}λ</text>
  <path class="component" d="M 300 76 H 470"/>
  <path class="component" d="M 300 70 v 12 M 470 70 v 12"/>
  <text class="label" x="385" y="67" text-anchor="middle">${result.spacingWavelengths.toFixed(6)}λ</text>
  <rect class="panel" x="620" y="89" width="105" height="60" rx="10"/>
  <text class="label" x="672" y="115" text-anchor="middle">Load</text>
  <text class="value" x="672" y="138" text-anchor="middle">${formatEngineering(result.loadImpedance.re, "Ω")}</text>`, {
    label: "Double-stub shunt impedance match",
  });
}
