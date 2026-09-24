import { formatEngineering, svgDocument } from "./svg.js";

function stubTermination(type, x) {
  if (type === "open") {
    return `<path class="component" d="M ${x - 16} 232 V 252 M ${x + 16} 232 V 252"/>`;
  }
  return `<path class="component" d="M ${x - 22} 240 H ${x + 22}"/>
  <path class="wire" d="M ${x - 15} 248 l 8 -8 M ${x - 3} 248 l 8 -8 M ${x + 9} 248 l 8 -8"/>`;
}

export function renderSingleStubSvg(result, solutionIndex = 0, termination = "short") {
  if (!new Set(["open", "short"]).has(termination)) {
    throw new RangeError('termination must be "open" or "short"');
  }
  const solution = result.solutions[solutionIndex];
  if (!solution) throw new RangeError(`No single-stub solution at index ${solutionIndex}`);

  const stubLength = termination === "open"
    ? solution.openStubLengthWavelengths
    : solution.shortedStubLengthWavelengths;
  const lossyLine = result.technique === "lossy-single-stub";
  const loadSign = result.loadImpedance.im < 0 ? "−" : "+";
  const feedLine = lossyLine
    ? `<path class="wire" d="M 165 123 H 225 M 325 123 H 610"/>
  <rect class="panel" x="225" y="101" width="100" height="44" rx="7"/>
  <text class="label" x="275" y="119" text-anchor="middle">Lossy line</text>
  <text class="value" x="275" y="137" text-anchor="middle">${result.attenuationDbPerWavelength.toPrecision(3)} dB/λ</text>`
    : `<path class="wire" d="M 165 123 H 610"/>`;
  const stubLabel = lossyLine
    ? `Ystub/Z₀ = ${solution.normalizedStubAdmittance.re.toFixed(4)} ${solution.normalizedStubAdmittance.im < 0 ? "−" : "+"} j${Math.abs(solution.normalizedStubAdmittance.im).toFixed(4)}`
    : `b = ${solution.normalizedStubSusceptance.toFixed(6)}`;

  return svgDocument(`<rect class="panel" x="10" y="10" width="740" height="260" rx="18"/>
  <text class="title" x="30" y="45">${lossyLine ? "Lossy-line single-stub match" : "Single-stub shunt match"}</text>
  <text class="muted" x="730" y="43" text-anchor="end">${termination}-circuited ${lossyLine ? "lossy " : ""}stub</text>
  <rect class="panel" x="35" y="92" width="130" height="62" rx="10"/>
  <text class="label" x="100" y="119" text-anchor="middle">Matched port</text>
  <text class="value" x="100" y="141" text-anchor="middle">${formatEngineering(result.characteristicImpedance, "Ω")}</text>
  ${feedLine}
  <circle class="node" cx="350" cy="123" r="6"/>
  <path class="wire" d="M 350 123 V 232"/>
  ${stubTermination(termination, 350)}
  <text class="label" x="350" y="78" text-anchor="middle">d = ${solution.distanceWavelengths.toFixed(6)}λ toward generator</text>
  <text class="value" x="375" y="184">${stubLabel}</text>
  <text class="value" x="375" y="207">ℓ = ${stubLength.toFixed(6)}λ</text>
  <rect class="panel" x="610" y="92" width="115" height="62" rx="10"/>
  <text class="label" x="667" y="118" text-anchor="middle">Load</text>
  <text class="value" x="667" y="141" text-anchor="middle">${formatEngineering(result.loadImpedance.re, "Ω")} ${loadSign} j${formatEngineering(Math.abs(result.loadImpedance.im), "Ω")}</text>`, {
    label: `Single-stub ${termination}-circuit shunt match`,
  });
}
