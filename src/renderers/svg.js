const PREFIXES = [
  { threshold: 1e9, scale: 1e9, symbol: "G" },
  { threshold: 1e6, scale: 1e6, symbol: "M" },
  { threshold: 1e3, scale: 1e3, symbol: "k" },
  { threshold: 1, scale: 1, symbol: "" },
  { threshold: 1e-3, scale: 1e-3, symbol: "m" },
  { threshold: 1e-6, scale: 1e-6, symbol: "µ" },
  { threshold: 1e-9, scale: 1e-9, symbol: "n" },
  { threshold: 1e-12, scale: 1e-12, symbol: "p" },
];

export function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

export function formatEngineering(value, unit, significantDigits = 4) {
  if (value === 0) return `0 ${unit}`.trim();
  const absolute = Math.abs(value);
  const prefix = PREFIXES.find(({ threshold }) => absolute >= threshold)
    ?? { scale: 1e-15, symbol: "f" };
  return `${(value / prefix.scale).toPrecision(significantDigits)} ${prefix.symbol}${unit}`.trim();
}

export function svgDocument(content, { width = 760, height = 280, label = "" } = {}) {
  return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(label)}" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">
  <style>
    .wire{fill:none;stroke:#16324f;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
    .component{fill:none;stroke:#d1495b;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
    .node{fill:#16324f}.panel{fill:#f5f8fb;stroke:#b9c9d8;stroke-width:2}
    .title{font:700 22px system-ui,sans-serif;fill:#16324f}.label{font:15px system-ui,sans-serif;fill:#263746}
    .value{font:600 14px ui-monospace,monospace;fill:#a22f41}.muted{font:13px system-ui,sans-serif;fill:#5f7181}
  </style>
${content}
</svg>`;
}
