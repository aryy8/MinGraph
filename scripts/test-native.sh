#!/usr/bin/env bash
# Builds and runs native/test.cpp with the host C++ compiler.
set -euo pipefail
cd "$(dirname "$0")/.."
CXX="${CXX:-c++}"
OUT="$(mktemp -d)/mingraph-test"
"$CXX" -std=c++17 -O2 -Wall -Wextra native/test.cpp -o "$OUT"
"$OUT" public/data
