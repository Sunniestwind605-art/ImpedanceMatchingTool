# Impedance Matching Tool

A dependency-free impedance-matching calculator with accessible SVG diagrams for:

- lumped L-networks;
- shunt single-stub matching;
- shunt double-stub matching; and
- quarter-wave transformers, including complex-load placement.

All line distances and stub lengths are fractions of a wavelength measured toward the generator. Stub susceptances are normalized to the main-line characteristic admittance.

## Run the browser tool

Serve the repository with any static web server, then open `index.html`. For example:

```sh
python -m http.server 8000
```

Then visit `http://localhost:8000`.

## Run the tests

Node.js 20 or newer is required. The test suite uses only Node's built-in test runner:

```sh
npm test
```

or:

```sh
node --test
```

The suite contains independent ground-truth vectors, final-match checks, constant-VSWR/Smith-chart invariants, edge cases, forbidden-region checks, and SVG structure tests.

## Library usage

```js
import {
  complex,
  calculateSingleStub,
  renderSingleStubSvg,
} from "./src/index.js";

const result = calculateSingleStub(complex(100, -50), 50);
const svg = renderSingleStubSvg(result, 0, "short");
```

The calculation modules are pure and do not depend on a browser. SVG renderers return complete SVG strings and validate solution selections.
