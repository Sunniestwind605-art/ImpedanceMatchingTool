import { complex, reciprocal } from "../core/complex.js";
import {
  reflectionCoefficient,
  transformNormalizedAdmittance,
  transformNormalizedImpedance,
  wrapHalfWavelength,
} from "../core/transmissionLine.js";
import { svgDocument } from "./svg.js";

const SIZE = 420;
const CENTER = SIZE / 2;
const RADIUS = 170;

function pointFromReflection(gamma) {
  return {
    x: CENTER + gamma.re * RADIUS,
    y: CENTER - gamma.im * RADIUS,
  };
}

function pathFromReflections(reflections) {
  return reflections.map((gamma, index) => {
    const { x, y } = pointFromReflection(gamma);
    return `${index ? "L" : "M"} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(" ");
}

function sampleLineImpedance(load, distance) {
  const steps = Math.max(24, Math.ceil(distance * 400));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const d = distance * index / steps;
    return reflectionCoefficient(transformNormalizedImpedance(load, d));
  });
}

function sampleLineAdmittance(loadY, distance) {
  const steps = Math.max(24, Math.ceil(distance * 400));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const d = distance * index / steps;
    const y = transformNormalizedAdmittance(loadY, d);
    return reflectionCoefficient(reciprocal(y));
  });
}

function gammaFromY(y) {
  return reflectionCoefficient(reciprocal(y));
}

function shuntArc(admittance, susceptanceAdded) {
  const steps = Math.max(12, Math.ceil(Math.abs(susceptanceAdded) * 40));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const b = susceptanceAdded * index / steps;
    return gammaFromY(complex(admittance.re, admittance.im + b));
  });
}

function seriesArc(impedance, normalizedReactanceAdded) {
  const steps = Math.max(16, Math.ceil(Math.abs(normalizedReactanceAdded) * 40));
  return Array.from({ length: steps + 1 }, (_, index) => {
    const x = impedance.im + normalizedReactanceAdded * index / steps;
    return reflectionCoefficient(complex(impedance.re, x));
  });
}

function sampleLNetwork(result, solution) {
  const zLoad = {
    re: result.loadImpedance.re / result.sourceResistance,
    im: result.loadImpedance.im / result.sourceResistance,
  };
  const start = reflectionCoefficient(complex(zLoad.re, zLoad.im));
  if (solution.topology === "matched") return [start, complex(0)];

  if (solution.topology === "series-then-shunt") {
    const seriesImpedance = complex(
      zLoad.re,
      zLoad.im + solution.seriesReactanceOhms / result.sourceResistance,
    );
    const beforeShuntY = reciprocal(seriesImpedance);
    const shuntB = solution.shuntSusceptanceSiemens * result.sourceResistance;
    return [start, ...seriesArc(complex(zLoad.re, zLoad.im), solution.seriesReactanceOhms / result.sourceResistance).slice(1), ...shuntArc(beforeShuntY, shuntB).slice(1)];
  }

  const loadY = reciprocal(complex(zLoad.re, zLoad.im));
  const shuntB = solution.shuntSusceptanceSiemens * result.sourceResistance;
  const yAfterShunt = complex(loadY.re, loadY.im + shuntB);
  const afterShuntZ = reciprocal(yAfterShunt);
  const gammaAfterShunt = reflectionCoefficient(afterShuntZ);
  return [start, ...shuntArc(loadY, shuntB).slice(1), ...seriesArc(afterShuntZ, solution.seriesReactanceOhms / result.sourceResistance).slice(1)];
}

function traceFor(result, technique, solution) {
  if (technique === "l-network") return [{ label: "Load → match", points: sampleLNetwork(result, solution) }];

  if (technique === "single-stub") {
    const loadY = reciprocal(complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    ));
    const line = sampleLineAdmittance(loadY, solution.distanceWavelengths);
    const yAtStub = transformNormalizedAdmittance(loadY, solution.distanceWavelengths);
    const stubB = solution.normalizedStubSusceptance;
    return [
      { label: "Load → stub position", points: line },
      { label: "Stub position → match", points: shuntArc(yAtStub, stubB) },
    ];
  }

  if (technique === "double-stub") {
    const loadY = reciprocal(complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    ));
    const startDistance = result.firstStubDistanceWavelengths;
    const firstLine = sampleLineAdmittance(loadY, startDistance);
    const yAtFirst = transformNormalizedAdmittance(loadY, startDistance);
    const firstAddition = shuntArc(yAtFirst, solution.firstStubSusceptance);
    const yAfterFirst = complex(
      yAtFirst.re,
      yAtFirst.im + solution.firstStubSusceptance,
    );
    const secondLine = sampleLineAdmittance(yAfterFirst, result.spacingWavelengths);
    const yAtSecond = transformNormalizedAdmittance(yAfterFirst, result.spacingWavelengths);
    const secondAddition = shuntArc(yAtSecond, solution.secondStubSusceptance);
    return [
      { label: "Load → first stub", points: firstLine },
      { label: "First stub", points: firstAddition },
      { label: "Between stubs", points: secondLine },
      { label: "Second stub → match", points: secondAddition },
    ];
  }

  if (technique === "quarter-wave") {
    const load = complex(
      result.loadImpedance.re / result.characteristicImpedance,
      result.loadImpedance.im / result.characteristicImpedance,
    );
    const line = sampleLineImpedance(load, solution.placementDistanceWavelengths);
    const atTransformer = transformNormalizedImpedance(load, solution.placementDistanceWavelengths);
    const startGamma = reflectionCoefficient(atTransformer);
    const steps = 100;
    const quarterWaveArc = Array.from({ length: steps + 1 }, (_, index) => {
      const fraction = index / steps;
      const angle = Math.atan2(startGamma.im, startGamma.re) + Math.PI * fraction;
      const radius = Math.hypot(startGamma.re, startGamma.im) * (1 - fraction);
      return complex(radius * Math.cos(angle), radius * Math.sin(angle));
    });
    return [
      { label: "Load → real crossing", points: line },
      { label: "Quarter-wave section → match", points: quarterWaveArc },
    ];
  }
  return [];
}

function gridSvg() {
  const parts = [];
  const resistanceValues = [0.2, 0.5, 1, 2, 5];
  for (const r of resistanceValues) {
    const centerGamma = r / (1 + r);
    const radiusGamma = 1 / (1 + r);
    const center = pointFromReflection(complex(centerGamma, 0));
    parts.push(`<circle class="smith-grid" cx="${center.x}" cy="${center.y}" r="${radiusGamma * RADIUS}"/>`);
  }

  for (const x of [-5, -2, -1, -0.5, -0.2, 0.2, 0.5, 1, 2, 5]) {
    const center = pointFromReflection(complex(1, 1 / x));
    const gridRadius = RADIUS / Math.abs(x);
    const samples = [];
    for (let index = 0; index <= 240; index += 1) {
      const angle = Math.PI * 2 * index / 240;
      const gamma = complex(
        1 + Math.cos(angle) / x,
        1 / x + Math.sin(angle) / x,
      );
      if (Math.hypot(gamma.re, gamma.im) <= 1.0001) samples.push(gamma);
    }
    if (samples.length > 1) {
      parts.push(`<path class="smith-grid" d="${pathFromReflections(samples)}"/>`);
    }
  }
  parts.push(`<line class="smith-axis" x1="${CENTER - RADIUS}" y1="${CENTER}" x2="${CENTER + RADIUS}" y2="${CENTER}"/>`);
  parts.push(`<circle class="smith-boundary" cx="${CENTER}" cy="${CENTER}" r="${RADIUS}"/>`);
  parts.push(`<circle class="smith-match" cx="${CENTER}" cy="${CENTER}" r="5"/>`);
  parts.push(`<text class="smith-tick" x="${CENTER - RADIUS}" y="${CENTER + 18}" text-anchor="middle">−1</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + RADIUS}" y="${CENTER + 18}" text-anchor="middle">+1</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + 9}" y="${CENTER - RADIUS + 13}">+j</text>`);
  parts.push(`<text class="smith-tick" x="${CENTER + 9}" y="${CENTER + RADIUS - 2}">−j</text>`);
  return parts.join("\n");
}

function markers(start, end, traces, technique) {
  const s = pointFromReflection(start);
  const e = pointFromReflection(end);
  const intermediate = traces.slice(0, -1).map((trace, index) => {
    const lastPoint = trace.points.at(-1) ?? start;
    const p = pointFromReflection(lastPoint);
    const pointLabel = technique === "single-stub"
      ? "Stub"
      : technique === "double-stub"
        ? ["Stub 1", "After stub 1", "Stub 2"][index] ?? `Step ${index + 1}`
        : technique === "quarter-wave"
          ? "Real Z"
          : "Network step";
    return `<circle class="smith-step" cx="${p.x}" cy="${p.y}" r="6" style="--step-order:${index}"><title>${pointLabel} point</title></circle>
      <text class="smith-step-label" x="${p.x + 9}" y="${p.y + 18}" style="--step-order:${index}">${pointLabel}</text>`;
  }).join("\n");
  return `<circle class="smith-start" cx="${s.x}" cy="${s.y}" r="7"><title>Starting load point</title></circle>
  <text class="smith-marker-label" x="${s.x + 10}" y="${s.y - 10}">Start</text>
  ${intermediate}
  <circle class="smith-end" cx="${e.x}" cy="${e.y}" r="7"><title>Matched endpoint</title></circle>
  <text class="smith-marker-label smith-match-label" x="${e.x + 10}" y="${e.y - 10}">Match</text>`;
}

export function renderSmithChartSvg(result, technique, solutionIndex = 0) {
  const solution = result.solutions[solutionIndex];
  if (!solution) {
    return svgDocument(`<rect class="panel" x="10" y="10" width="400" height="400" rx="18"/>
      <text class="label" x="210" y="210" text-anchor="middle">No matching solution on this chart.</text>`, {
      width: 420,
      height: 420,
      label: "No Smith chart solution available",
    });
  }

  const traces = traceFor(result, technique, solution);
  const loadZ = technique === "l-network"
    ? complex(result.loadImpedance.re / result.sourceResistance, result.loadImpedance.im / result.sourceResistance)
    : complex(result.loadImpedance.re / result.characteristicImpedance, result.loadImpedance.im / result.characteristicImpedance);
  const start = reflectionCoefficient(loadZ);
  const end = complex(0);
  const traceSvg = traces.map((trace, index) => {
    const points = trace.points;
    if (index === 0 && points.length) {
      points[0] = start;
      if (index === traces.length - 1) points[points.length - 1] = end;
    }
    if (index === traces.length - 1 && points.length) points[points.length - 1] = end;
    return `<path class="smith-trace trace-${index}" pathLength="1" d="${pathFromReflections(points)}" style="--draw-order:${index}" aria-label="${trace.label}"/>`;
  }).join("\n");

  return svgDocument(`<rect class="panel" x="4" y="4" width="412" height="412" rx="18"/>
  ${gridSvg()}
  ${traceSvg}
  ${markers(start, end, traces, technique)}
  <text class="smith-caption" x="210" y="405" text-anchor="middle">Normalized impedance • clockwise toward generator</text>`, {
    width: 420,
    height: 420,
    label: `Animated Smith chart for ${technique}`,
  });
}
