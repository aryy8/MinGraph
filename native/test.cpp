// Native agreement test: Dijkstra, A* and bidirectional Dijkstra must return
// the same shortest distance on 20 random pairs of the Jaipur graph.
//
//   npm run test:native      (or: clang++ -std=c++17 -O2 native/test.cpp -o /tmp/t && /tmp/t public/data)
#include <cstdio>
#include <cstdlib>
#include <fstream>
#include <random>
#include <string>
#include <vector>

#include "mingraph.hpp"

template <typename T>
static bool readAll(const std::string& file, std::vector<T>& out) {
  std::ifstream in(file, std::ios::binary | std::ios::ate);
  if (!in) return false;
  const std::streamsize bytes = in.tellg();
  in.seekg(0);
  out.resize(static_cast<size_t>(bytes) / sizeof(T));
  return static_cast<bool>(in.read(reinterpret_cast<char*>(out.data()), bytes));
}

int main(int argc, char** argv) {
  const std::string dir = argc > 1 ? argv[1] : "public/data";
  std::vector<float> coords, weights;
  std::vector<int32_t> offsets, targets;
  if (!readAll(dir + "/nodes.bin", coords) || !readAll(dir + "/offsets.bin", offsets) ||
      !readAll(dir + "/targets.bin", targets) || !readAll(dir + "/weights.bin", weights)) {
    std::fprintf(stderr, "Could not read graph from %s. Run npm run build:graph first.\n", dir.c_str());
    return 2;
  }
  const int32_t n = static_cast<int32_t>(offsets.size()) - 1;
  const int32_t m = static_cast<int32_t>(targets.size());
  mg::Graph g;
  g.attach(coords.data(), offsets.data(), targets.data(), weights.data(), n, m);
  mg::Solver solver(g);
  std::printf("Graph: %d nodes, %d edges\n", n, m);

  std::mt19937 rng(20241003);
  std::uniform_int_distribution<int32_t> pick(0, n - 1);
  int failures = 0;
  mg::Trace dj, as, bi, bf;
  for (int i = 0; i < 20; ++i) {
    const int32_t s = pick(rng);
    const int32_t t = pick(rng);
    solver.run(mg::kDijkstra, s, t, dj);
    solver.run(mg::kAStar, s, t, as);
    solver.run(mg::kBidirectional, s, t, bi);
    solver.run(mg::kBfs, s, t, bf);
    const double tol = 1e-6 * dj.distance + 1e-3;
    const bool ok = dj.found && as.found && bi.found && bf.found &&
                    std::abs(dj.distance - as.distance) <= tol &&
                    std::abs(dj.distance - bi.distance) <= tol && bf.distance + tol >= dj.distance;
    if (!ok) failures++;
    std::printf("%2d  %6d -> %6d  dijkstra %10.2f m  a* %10.2f m  bidir %10.2f m  bfs %10.2f m  visited %6d/%6d/%6d  %s\n",
                i + 1, s, t, dj.distance, as.distance, bi.distance, bf.distance, dj.nodesVisited,
                as.nodesVisited, bi.nodesVisited, ok ? "ok" : "MISMATCH");
  }
  if (failures) {
    std::printf("%d of 20 pairs disagree\n", failures);
    return 1;
  }
  std::printf("All 20 pairs agree\n");
  return 0;
}
