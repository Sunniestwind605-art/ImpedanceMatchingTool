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
    .wire{fill:none;stroke:#293021;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
    .component{fill:none;stroke:#72775a;stroke-width:4;stroke-linecap:round;stroke-linejoin:round}
    .node{fill:#293021}.panel{fill:#fffdf0;stroke:#d8d2a1;stroke-width:2}
    .title{font:700 22px system-ui,sans-serif;fill:#293021}.label{font:15px system-ui,sans-serif;fill:#34392a}
    .value{font:600 14px ui-monospace,monospace;fill:#77713c}.muted{font:13px system-ui,sans-serif;fill:#74765f}
    .smith-grid{fill:none;stroke:#d8d2a1;stroke-width:1.2}.smith-axis{stroke:#9a9879;stroke-width:1;stroke-dasharray:4 4}
    .smith-boundary{fill:#fbfae9;stroke:#77775e;stroke-width:2}.smith-match{fill:#bb5739}
    .smith-trace{fill:none;stroke:#c65b3b;stroke-width:3;stroke-linecap:round;stroke-linejoin:round;stroke-dasharray:1;stroke-dashoffset:1;animation:draw-trace 1.3s cubic-bezier(.3,.65,.3,1) both;animation-delay:calc(var(--draw-order)*1.4s)}
    .smith-step{fill:#f2d27a;stroke:#555842;stroke-width:2;opacity:0;animation:mark-step .35s ease-out both;animation-delay:calc((var(--step-order) + 1)*1.4s)}
    .smith-step-label{font:700 11px system-ui,sans-serif;fill:#293021;paint-order:stroke;stroke:#fffdf0;stroke-width:4px;stroke-linejoin:round;opacity:0;animation:mark-step .35s ease-out both;animation-delay:calc((var(--step-order) + 1)*1.4s)}
    .trace-1{stroke:#72775a}.trace-2{stroke:#a99a4e}.trace-3{stroke:#293021}
    .smith-start{fill:#c65b3b;stroke:#fffdf0;stroke-width:2}.smith-end{fill:#4f805e;stroke:#fffdf0;stroke-width:2}
    .smith-marker-label{font:700 12px system-ui,sans-serif;fill:#293021;paint-order:stroke;stroke:#fffdf0;stroke-width:4px;stroke-linejoin:round}
    .smith-tick,.smith-caption{font:11px system-ui,sans-serif;fill:#74765f}
    @keyframes draw-trace{to{stroke-dashoffset:0}}
    @keyframes mark-step{to{opacity:1}}
    @media(prefers-reduced-motion:reduce){.smith-trace,.smith-step,.smith-step-label{animation:none;stroke-dashoffset:0;opacity:1}}
  </style>
${content}
</svg>`;
}
