import { formatEngineering, svgDocument } from "./svg.js";

function componentLabel(component) {
  if (component.kind === "none") return "No component";
  return `${component.kind === "inductor" ? "L" : "C"} = ${formatEngineering(component.value, component.unit)}`;
}

function elementSymbol(kind, x, y, orientation = "horizontal") {
  if (kind === "none") return `<path class="wire" d="M ${orientation === "horizontal" ? `${x - 45} ${y} H ${x + 45}` : `${x} ${y - 30} V ${y + 30}`}"/>`;
  if (kind === "capacitor") {
    return orientation === "horizontal"
      ? `<path class="component" d="M ${x - 6} ${y - 18} V ${y + 18} M ${x + 6} ${y - 18} V ${y + 18}"/>`
      : `<path class="component" d="M ${x - 18} ${y - 6} H ${x + 18} M ${x - 18} ${y + 6} H ${x + 18}"/>`;
  }
  return orientation === "horizontal"
    ? `<path class="component" d="M ${x - 36} ${y} c 8 -24 16 -24 24 0 c 8 -24 16 -24 24 0 c 8 -24 16 -24 24 0 c 8 -24 16 -24 24 0"/>`
    : `<path class="component" d="M ${x} ${y - 36} c -24 8 -24 16 0 24 c -24 8 -24 16 0 24 c -24 8 -24 16 0 24 c -24 8 -24 16 0 24"/>`;
}

function seriesSymbol(x, label, component) {
  const left = component.kind === "capacitor" ? x - 6 : x - 36;
  const right = component.kind === "capacitor" ? x + 6 : x + 36;
  return `<path class="wire" d="M ${x - 70} 130 H ${left}"/>
  ${elementSymbol(component.kind, x, 130)}
  <path class="wire" d="M ${right} 130 H ${x + 75}"/>
  <text class="label" x="${x}" y="92" text-anchor="middle">Series element</text>
  <text class="value" x="${x}" y="178" text-anchor="middle">${label}</text>`;
}

function shuntSymbol(x, label, component) {
  const upperLead = component.kind === "capacitor" ? 172 : 142;
  const lowerLead = component.kind === "capacitor" ? 184 : 214;
  return `<circle class="node" cx="${x}" cy="130" r="6"/>
  <path class="wire" d="M ${x} 130 V ${upperLead}"/>
  ${elementSymbol(component.kind, x, 178, "vertical")}
  <path class="wire" d="M ${x} ${lowerLead} V 226 M ${x - 24} 226 H ${x + 24} M ${x - 16} 236 H ${x + 16} M ${x - 8} 246 H ${x + 8}"/>
  <text class="value" x="${x + 20}" y="190">${label}</text>`;
}

export function renderLNetworkSvg(result, solutionIndex = 0) {
  const solution = result.solutions[solutionIndex];
  if (!solution) throw new RangeError(`No L-network solution at index ${solutionIndex}`);

  const seriesX = solution.seriesReactanceOhms;
  const shuntB = solution.shuntSusceptanceSiemens;
  const sourceLabel = `Source ${formatEngineering(result.sourceResistance, "Ω")}`;
  const loadLabel = `Load ${formatEngineering(result.loadImpedance.re, "Ω")} ${result.loadImpedance.im < 0 ? "−" : "+"} j${formatEngineering(Math.abs(result.loadImpedance.im), "Ω")}`;

  let network;
  if (solution.topology === "matched") {
    network = `<path class="wire" d="M 170 130 H 590"/>
  <text class="value" x="380" y="105" text-anchor="middle">Already matched — no components required</text>`;
  } else {
    const series = seriesSymbol(380, `${componentLabel(solution.seriesComponent)} (X ${seriesX < 0 ? "−" : "+"}${formatEngineering(Math.abs(seriesX), "Ω")})`, solution.seriesComponent);
    const shuntX = solution.topology === "series-then-shunt" ? 245 : 515;
    network = `<path class="wire" d="M 170 130 H 305 M 455 130 H 590"/>
  ${series}
  ${shuntSymbol(shuntX, `${componentLabel(solution.shuntComponent)} (B ${shuntB < 0 ? "−" : "+"}${formatEngineering(Math.abs(shuntB), "S")})`, solution.shuntComponent)}`;
  }

  return svgDocument(`<rect class="panel" x="10" y="10" width="740" height="260" rx="18"/>
  <text class="title" x="30" y="45">L-network match</text>
  <text class="muted" x="730" y="43" text-anchor="end">${solution.topology}</text>
  <rect class="panel" x="35" y="100" width="135" height="60" rx="10"/>
  <text class="label" x="102" y="135" text-anchor="middle">${sourceLabel}</text>
  ${network}
  <rect class="panel" x="590" y="100" width="135" height="60" rx="10"/>
  <text class="label" x="657" y="126" text-anchor="middle">${loadLabel}</text>
  <text class="muted" x="657" y="148" text-anchor="middle">${formatEngineering(result.frequencyHz, "Hz")}</text>`, {
    label: `L-network impedance match, ${solution.topology}`,
  });
}
