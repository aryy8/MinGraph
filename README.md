# MinGraph

MinGraph is an animated pathfinding visualizer built on the real road network of Jaipur, India (257,620 nodes, 557,385 directed edges). It features interactive step replay, live frontier tracking, and side-by-side algorithm comparison with camera synchronization.

Pathfinding algorithms (Dijkstra, A*, BFS, Bidirectional Dijkstra) are implemented by hand in C++17 with a custom binary min-heap and compiled to WebAssembly via Emscripten. The client runs searches inside Web Workers and streams GPU-accelerated traces through deck.gl over MapLibre GL JS with CARTO Positron vector tiles.

---

## Features

- **Real Road Graph (Jaipur)**: Derived from OpenStreetMap via Overpass API. Retains all drivable highways, accounts for one-way streets, reverse directions, and roundabouts. Extracted to its largest strongly connected component (257k+ nodes) and stored in compact binary CSR arrays (`public/data/`). Snapped on-the-fly via a spatial grid index.
- **Hand-written C++17 Core in WebAssembly**:
  - Indexed binary min-heap with decrease-key.
  - Algorithms: Dijkstra, A* (haversine admissible heuristic), BFS (turn count), and Bidirectional Dijkstra with alternating search queues.
  - Generates step-by-step exploration traces (visited edges in order, frontier sizes, final path, relaxation counts, execution time).
- **Two Visualization Modes**:
  - **Simulate**: Animate search expansion outward from source to destination. Track active frontier lines, view route draw-in, and auto-zoom to path bounds. Full playback controls with scrub timeline and 1x–100x speed.
  - **Compare**: Side-by-side camera-synced maps displaying two chosen algorithms simultaneously (ink-blue vs. terracotta). Parallel execution across web workers with a comprehensive metrics comparison table, direct-labeled SVG bar chart of explored nodes, and dynamic insight sentence.
- **Survey Instrument / Atlas Visual Design**:
  - Crisp clean white (`#FFFFFF`), dark ink (`#111827`), subtle neutral borders (`#E5E7EB`), and terracotta (`#C2410C`) styling.
  - Hairline borders, 2px radius, zero glassmorphism or neon gradients.
  - Tabular monospace numerals across all counters and tables.
- **Geocoding & Waypoints**:
  - Server-side `/api/geocode` proxying Nominatim with Jaipur bounding box constraints.
  - Debounced autocomplete, map-click destination setting, and quick-pick landmark presets (Hawa Mahal, Jaipur Junction, Amer Fort, Jaipur Airport, Albert Hall).

---

## Setup & Running Locally

### Prerequisites
- Node.js 18+ (tested on Node 20 / 23)
- npm

### Installation

```bash
git clone <repo-url>
cd MinGraph
npm install
```

### Build Graph Data (Optional / Pre-bundled)
The Jaipur road network binaries are already generated and committed in `public/data/`. To re-fetch and rebuild from OpenStreetMap:

```bash
npm run build:graph
```

### Build WebAssembly (Optional / Pre-bundled)
Precompiled `.wasm` and glue JS are already committed in `public/wasm/`. To recompile using Emscripten:

```bash
npm run build:wasm
```

### Run Automated Tests

Run the TypeScript/WebAssembly agreement test (verifies Dijkstra, A*, and Bidirectional Dijkstra return identical optimal distances across 20 random Jaipur pairs):

```bash
npm test
```

Run the native C++ test using the host compiler:

```bash
npm run test:native
```

### Development Server

Start the development server at [http://localhost:3000](http://localhost:3000):

```bash
npm run dev
```

### Production Build

```bash
npm run build
npm start
```

---

## Deploying to Vercel

MinGraph is designed to deploy to Vercel with zero extra configuration:
1. Push this repository to GitHub or GitLab.
2. Import the project in the [Vercel Dashboard](https://vercel.com/new).
3. The framework preset is automatically detected as **Next.js**.
4. Deploy! Because both the pre-built graph binaries (`public/data/`) and WebAssembly modules (`public/wasm/`) are committed, Vercel requires no C++ or Emscripten toolchains at build time.
