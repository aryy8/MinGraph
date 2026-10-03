// WebAssembly entry points. The worker copies the graph into the WASM heap
// (via _malloc), calls mg_load once, then mg_run per query and reads the trace
// back through the pointer/length getters.
#include "mingraph.hpp"

#ifdef __EMSCRIPTEN__
#include <emscripten/emscripten.h>
#define MG_EXPORT EMSCRIPTEN_KEEPALIVE
#else
#define MG_EXPORT
#endif

namespace {
mg::Graph g_graph;
mg::Solver* g_solver = nullptr;
mg::Trace g_trace;
}  // namespace

extern "C" {

MG_EXPORT int32_t mg_load(const float* coords, const int32_t* offsets, const int32_t* targets,
                          const float* weights, int32_t n, int32_t m) {
  g_graph.attach(coords, offsets, targets, weights, n, m);
  delete g_solver;
  g_solver = new mg::Solver(g_graph);
  return n;
}

// Returns 1 if a path was found, 0 if not, -1 if the graph is not loaded.
MG_EXPORT int32_t mg_run(int32_t algorithm, int32_t src, int32_t dst) {
  if (!g_solver) return -1;
  g_solver->run(algorithm, src, dst, g_trace);
  return g_trace.found ? 1 : 0;
}

MG_EXPORT const int32_t* mg_explored_ptr() { return g_trace.explored.data(); }
MG_EXPORT int32_t mg_explored_len() { return static_cast<int32_t>(g_trace.explored.size()); }
MG_EXPORT const int32_t* mg_frontier_ptr() { return g_trace.frontier.data(); }
MG_EXPORT int32_t mg_frontier_len() { return static_cast<int32_t>(g_trace.frontier.size()); }
MG_EXPORT const int32_t* mg_path_ptr() { return g_trace.path.data(); }
MG_EXPORT int32_t mg_path_len() { return static_cast<int32_t>(g_trace.path.size()); }
MG_EXPORT double mg_distance() { return g_trace.distance; }
MG_EXPORT int32_t mg_nodes_visited() { return g_trace.nodesVisited; }
MG_EXPORT int32_t mg_edges_relaxed() { return g_trace.edgesRelaxed; }
MG_EXPORT double mg_compute_ms() { return g_trace.computeMs; }

}  // extern "C"
