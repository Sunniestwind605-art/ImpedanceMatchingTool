import { formatEngineering, svgDocument } from "./svg.js";

export function renderQuarterWaveSvg(result, solutionIndex = 0) {
  const solution = result.solutions[solutionIndex];
  if (!solution) throw new RangeError(`No quarter-wave solution at index ${solutionIndex}`);
  const loadSign = result.loadImpedance.im < 0 ? "−" : "+";
  const status = result.required
    ? "Quarter-wave transformer"
    : "Already matched — transformer optional";

  return svgDocument(`<rect class="panel" x="10" y="10" width="740" height="260" rx="18"/>
  <text class="title" x="30" y="45">Quarter-wave match</text>
  <text class="muted" x="730" y="43" text-anchor="end">${status}</text>
  <rect class="panel" x="30" y="100" width="120" height="60" rx="10"/>
  <text class="label" x="90" y="125" text-anchor="middle">Matched port</text>
  <text class="value" x="90" y="148" text-anchor="middle">${formatEngineering(result.characteristicImpedance, "Ω")}</text>
  <path class="wire" d="M 150 130 H 240 M 460 130 H 625"/>
  <rect x="240" y="91" width="220" height="78" rx="12" fill="#fff2db" stroke="#d58936" stroke-width="4"/>
  <path d="M 255 130 H 445" stroke="#d58936" stroke-width="8"/>
  <text class="label" x="350" y="78" text-anchor="middle">Zₜ = ${formatEngineering(solution.transformerImpedanceOhms, "Ω")}</text>
  <text class="value" x="350" y="197" text-anchor="middle">ℓ = ${solution.transformerLengthWavelengths.toFixed(6)}λ</text>
  <path class="component" d="M 475 72 H 610 M 475 66 v 12 M 610 66 v 12"/>
  <text class="label" x="542" y="61" text-anchor="middle">placement d = ${solution.placementDistanceWavelengths.toFixed(6)}λ</text>
  <text class="muted" x="542" y="187" text-anchor="middle">real termination ${formatEngineering(solution.terminationResistanceOhms, "Ω")}</text>
  <rect class="panel" x="625" y="100" width="100" height="60" rx="10"/>
  <text class="label" x="675" y="124" text-anchor="middle">Load</text>
  <text class="value" x="675" y="148" text-anchor="middle">${formatEngineering(result.loadImpedance.re, "Ω")} ${loadSign} j${formatEngineering(Math.abs(result.loadImpedance.im), "Ω")}</text>`, {
    label: `Quarter-wave transformer match using ${solution.transformerImpedanceOhms} ohms`,
  });
}
