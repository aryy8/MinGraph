#!/usr/bin/env bash
# Compiles native/mingraph.cpp to public/wasm/ with Emscripten.
# Requires emcc on PATH, or an emsdk checkout at $EMSDK / ~/emsdk.
set -euo pipefail
cd "$(dirname "$0")/.."

if ! command -v emcc >/dev/null 2>&1; then
  EMSDK_DIR="${EMSDK:-$HOME/emsdk}"
  if [ -f "$EMSDK_DIR/emsdk_env.sh" ]; then
    # shellcheck disable=SC1091
    source "$EMSDK_DIR/emsdk_env.sh" >/dev/null 2>&1
  else
    echo "emcc not found. Install emsdk: https://emscripten.org/docs/getting_started/downloads.html" >&2
    exit 1
  fi
fi

mkdir -p public/wasm
emcc native/mingraph.cpp \
  -std=c++17 -O3 \
  -fno-exceptions -fno-rtti \
  -sMODULARIZE=1 \
  -sEXPORT_ES6=1 \
  -sEXPORT_NAME=createMinGraph \
  -sENVIRONMENT=web,worker,node \
  -sALLOW_MEMORY_GROWTH=1 \
  -sINITIAL_MEMORY=33554432 \
  -sFILESYSTEM=0 \
  -sEXPORTED_FUNCTIONS=_malloc,_free,_mg_load,_mg_run,_mg_explored_ptr,_mg_explored_len,_mg_frontier_ptr,_mg_frontier_len,_mg_path_ptr,_mg_path_len,_mg_distance,_mg_nodes_visited,_mg_edges_relaxed,_mg_compute_ms \
  -sEXPORTED_RUNTIME_METHODS=cwrap,HEAPU8,HEAP32,HEAPF32 \
  -o public/wasm/mingraph.js

ls -l public/wasm
