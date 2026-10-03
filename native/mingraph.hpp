// MinGraph core: graph storage, an indexed binary min-heap, and four search
// algorithms that record a step trace. C++17, no external libraries.
#pragma once

#include <chrono>
#include <cmath>
#include <cstdint>
#include <limits>
#include <vector>

namespace mg {

constexpr double kInf = std::numeric_limits<double>::infinity();
constexpr double kEarthRadius = 6371008.8;
constexpr double kDegToRad = 3.14159265358979323846 / 180.0;

enum Algorithm : int32_t {
  kDijkstra = 0,
  kAStar = 1,
  kBfs = 2,
  kBidirectional = 3,
};

inline double haversine(double lon1, double lat1, double lon2, double lat2) {
  const double dLat = (lat2 - lat1) * kDegToRad;
  const double dLon = (lon2 - lon1) * kDegToRad;
  const double s1 = std::sin(dLat * 0.5);
  const double s2 = std::sin(dLon * 0.5);
  double a = s1 * s1 + std::cos(lat1 * kDegToRad) * std::cos(lat2 * kDegToRad) * s2 * s2;
  if (a > 1.0) a = 1.0;
  return 2.0 * kEarthRadius * std::asin(std::sqrt(a));
}

// Forward CSR arrays are borrowed (owned by the caller); the reverse CSR,
// needed by bidirectional search, is built once and owned here.
struct Graph {
  int32_t n = 0;
  int32_t m = 0;
  const float* coords = nullptr;   // lon, lat interleaved, 2n
  const int32_t* off = nullptr;    // n + 1
  const int32_t* tgt = nullptr;    // m
  const float* w = nullptr;        // m
  std::vector<int32_t> roff;       // n + 1
  std::vector<int32_t> rsrc;       // m
  std::vector<float> rw;           // m

  void attach(const float* c, const int32_t* o, const int32_t* t, const float* wt, int32_t nodes, int32_t edges) {
    coords = c;
    off = o;
    tgt = t;
    w = wt;
    n = nodes;
    m = edges;
    roff.assign(static_cast<size_t>(n) + 1, 0);
    rsrc.assign(static_cast<size_t>(m), 0);
    rw.assign(static_cast<size_t>(m), 0.0f);
    for (int32_t e = 0; e < m; ++e) roff[tgt[e] + 1]++;
    for (int32_t i = 0; i < n; ++i) roff[i + 1] += roff[i];
    std::vector<int32_t> fill(roff.begin(), roff.end() - 1);
    for (int32_t u = 0; u < n; ++u) {
      for (int32_t e = off[u]; e < off[u + 1]; ++e) {
        const int32_t slot = fill[tgt[e]]++;
        rsrc[slot] = u;
        rw[slot] = w[e];
      }
    }
  }

  double lon(int32_t v) const { return coords[2 * v]; }
  double lat(int32_t v) const { return coords[2 * v + 1]; }
};

// Indexed binary min-heap keyed by node id, with decrease-key.
class MinHeap {
 public:
  void reset(int32_t n) {
    pos_.assign(static_cast<size_t>(n), -1);
    key_.assign(static_cast<size_t>(n), kInf);
    heap_.clear();
  }
  bool empty() const { return heap_.empty(); }
  int32_t size() const { return static_cast<int32_t>(heap_.size()); }
  double topKey() const { return key_[heap_[0]]; }

  // Inserts v or lowers its key. Ignores increases.
  void push(int32_t v, double k) {
    int32_t i = pos_[v];
    if (i < 0) {
      i = static_cast<int32_t>(heap_.size());
      heap_.push_back(v);
      pos_[v] = i;
      key_[v] = k;
    } else if (k < key_[v]) {
      key_[v] = k;
    } else {
      return;
    }
    siftUp(i);
  }

  int32_t pop() {
    const int32_t top = heap_[0];
    const int32_t last = heap_.back();
    heap_.pop_back();
    pos_[top] = -2;  // settled marker
    if (!heap_.empty()) {
      heap_[0] = last;
      pos_[last] = 0;
      siftDown(0);
    }
    return top;
  }

 private:
  void siftUp(int32_t i) {
    const int32_t v = heap_[i];
    const double k = key_[v];
    while (i > 0) {
      const int32_t parent = (i - 1) >> 1;
      const int32_t pv = heap_[parent];
      if (key_[pv] <= k) break;
      heap_[i] = pv;
      pos_[pv] = i;
      i = parent;
    }
    heap_[i] = v;
    pos_[v] = i;
  }

  void siftDown(int32_t i) {
    const int32_t n = static_cast<int32_t>(heap_.size());
    const int32_t v = heap_[i];
    const double k = key_[v];
    for (;;) {
      int32_t child = 2 * i + 1;
      if (child >= n) break;
      if (child + 1 < n && key_[heap_[child + 1]] < key_[heap_[child]]) child++;
      const int32_t cv = heap_[child];
      if (key_[cv] >= k) break;
      heap_[i] = cv;
      pos_[cv] = i;
      i = child;
    }
    heap_[i] = v;
    pos_[v] = i;
  }

  std::vector<int32_t> heap_;
  std::vector<int32_t> pos_;
  std::vector<double> key_;
};

// Everything the UI needs to replay a search.
struct Trace {
  std::vector<int32_t> explored;  // (from, to) pairs in visit order
  std::vector<int32_t> frontier;  // frontier size after each explored edge
  std::vector<int32_t> path;      // node ids, source to target
  double distance = -1.0;         // meters along path, -1 if none
  int32_t nodesVisited = 0;
  int32_t edgesRelaxed = 0;
  double computeMs = 0.0;
  bool found = false;

  void clear() {
    explored.clear();
    frontier.clear();
    path.clear();
    distance = -1.0;
    nodesVisited = 0;
    edgesRelaxed = 0;
    computeMs = 0.0;
    found = false;
  }
};

class Solver {
 public:
  explicit Solver(const Graph& g) : g_(g) {}

  void run(int32_t algorithm, int32_t s, int32_t t, Trace& out) {
    out.clear();
    if (s < 0 || t < 0 || s >= g_.n || t >= g_.n) return;
    const auto t0 = std::chrono::steady_clock::now();
    switch (algorithm) {
      case kDijkstra: bestFirst(s, t, false, out); break;
      case kAStar: bestFirst(s, t, true, out); break;
      case kBfs: bfs(s, t, out); break;
      case kBidirectional: bidirectional(s, t, out); break;
      default: break;
    }
    const auto t1 = std::chrono::steady_clock::now();
    out.computeMs = std::chrono::duration<double, std::milli>(t1 - t0).count();
  }

 private:
  // Edge weight u -> v (smallest if parallel edges exist).
  double edgeWeight(int32_t u, int32_t v) const {
    double best = kInf;
    for (int32_t e = g_.off[u]; e < g_.off[u + 1]; ++e) {
      if (g_.tgt[e] == v && g_.w[e] < best) best = g_.w[e];
    }
    return best;
  }

  void finishPath(Trace& out) {
    double d = 0.0;
    for (size_t i = 1; i < out.path.size(); ++i) d += edgeWeight(out.path[i - 1], out.path[i]);
    out.distance = d;
    out.found = true;
  }

  void tracePath(int32_t t) {
    pathTmp_.clear();
    for (int32_t v = t; v >= 0; v = parent_[v]) pathTmp_.push_back(v);
  }

  // Dijkstra (useHeuristic = false) or A* with a haversine heuristic.
  void bestFirst(int32_t s, int32_t t, bool useHeuristic, Trace& out) {
    const int32_t n = g_.n;
    dist_.assign(n, kInf);
    parent_.assign(n, -1);
    settled_.assign(n, 0);
    heapF_.reset(n);
    const double tLon = g_.lon(t);
    const double tLat = g_.lat(t);
    // Slightly shrunk so float32 rounding of weights can never make it inadmissible.
    auto h = [&](int32_t v) -> double {
      return useHeuristic ? haversine(g_.lon(v), g_.lat(v), tLon, tLat) * 0.99999 : 0.0;
    };

    dist_[s] = 0.0;
    heapF_.push(s, h(s));
    while (!heapF_.empty()) {
      const int32_t u = heapF_.pop();
      settled_[u] = 1;
      out.nodesVisited++;
      if (parent_[u] >= 0) {
        out.explored.push_back(parent_[u]);
        out.explored.push_back(u);
        out.frontier.push_back(heapF_.size());
      }
      if (u == t) break;
      const double du = dist_[u];
      for (int32_t e = g_.off[u]; e < g_.off[u + 1]; ++e) {
        const int32_t v = g_.tgt[e];
        if (settled_[v]) continue;
        out.edgesRelaxed++;
        const double nd = du + g_.w[e];
        if (nd < dist_[v]) {
          dist_[v] = nd;
          parent_[v] = u;
          heapF_.push(v, nd + h(v));
        }
      }
    }
    if (!settled_[t]) return;
    tracePath(t);
    out.path.assign(pathTmp_.rbegin(), pathTmp_.rend());
    finishPath(out);
  }

  // Breadth-first search by hop count. Ignores edge lengths, so not optimal.
  void bfs(int32_t s, int32_t t, Trace& out) {
    const int32_t n = g_.n;
    parent_.assign(n, -1);
    settled_.assign(n, 0);
    queue_.assign(n, 0);
    int32_t head = 0;
    int32_t tail = 0;
    queue_[tail++] = s;
    settled_[s] = 1;
    bool reached = false;
    while (head < tail) {
      const int32_t u = queue_[head++];
      out.nodesVisited++;
      if (parent_[u] >= 0) {
        out.explored.push_back(parent_[u]);
        out.explored.push_back(u);
        out.frontier.push_back(tail - head);
      }
      if (u == t) {
        reached = true;
        break;
      }
      for (int32_t e = g_.off[u]; e < g_.off[u + 1]; ++e) {
        const int32_t v = g_.tgt[e];
        out.edgesRelaxed++;
        if (settled_[v]) continue;
        settled_[v] = 1;
        parent_[v] = u;
        queue_[tail++] = v;
      }
    }
    if (!reached) return;
    tracePath(t);
    out.path.assign(pathTmp_.rbegin(), pathTmp_.rend());
    finishPath(out);
  }

  // Bidirectional Dijkstra: forward from s on the graph, backward from t on
  // the reverse graph, alternating on the smaller tentative key. Stops when
  // topF + topB >= best meeting cost.
  void bidirectional(int32_t s, int32_t t, Trace& out) {
    const int32_t n = g_.n;
    dist_.assign(n, kInf);
    distB_.assign(n, kInf);
    parent_.assign(n, -1);
    parentB_.assign(n, -1);
    settled_.assign(n, 0);
    settledB_.assign(n, 0);
    heapF_.reset(n);
    heapB_.reset(n);

    if (s == t) {
      out.nodesVisited = 1;
      out.path.push_back(s);
      out.distance = 0.0;
      out.found = true;
      return;
    }

    dist_[s] = 0.0;
    distB_[t] = 0.0;
    heapF_.push(s, 0.0);
    heapB_.push(t, 0.0);
    double mu = kInf;
    int32_t meetU = -1;  // meeting edge meetU -> meetV
    int32_t meetV = -1;

    while (!heapF_.empty() && !heapB_.empty()) {
      if (heapF_.topKey() + heapB_.topKey() >= mu) break;
      if (heapF_.topKey() <= heapB_.topKey()) {
        const int32_t u = heapF_.pop();
        settled_[u] = 1;
        out.nodesVisited++;
        if (parent_[u] >= 0) {
          out.explored.push_back(parent_[u]);
          out.explored.push_back(u);
          out.frontier.push_back(heapF_.size() + heapB_.size());
        }
        const double du = dist_[u];
        for (int32_t e = g_.off[u]; e < g_.off[u + 1]; ++e) {
          const int32_t v = g_.tgt[e];
          const double nd = du + g_.w[e];
          if (!settled_[v]) {
            out.edgesRelaxed++;
            if (nd < dist_[v]) {
              dist_[v] = nd;
              parent_[v] = u;
              heapF_.push(v, nd);
            }
          }
          if (distB_[v] < kInf && nd + distB_[v] < mu) {
            mu = nd + distB_[v];
            meetU = u;
            meetV = v;
          }
        }
      } else {
        const int32_t u = heapB_.pop();
        settledB_[u] = 1;
        out.nodesVisited++;
        if (parentB_[u] >= 0) {
          out.explored.push_back(parentB_[u]);
          out.explored.push_back(u);
          out.frontier.push_back(heapF_.size() + heapB_.size());
        }
        const double du = distB_[u];
        for (int32_t e = g_.roff[u]; e < g_.roff[u + 1]; ++e) {
          const int32_t x = g_.rsrc[e];  // edge x -> u
          const double nd = du + g_.rw[e];
          if (!settledB_[x]) {
            out.edgesRelaxed++;
            if (nd < distB_[x]) {
              distB_[x] = nd;
              parentB_[x] = u;
              heapB_.push(x, nd);
            }
          }
          if (dist_[x] < kInf && dist_[x] + nd < mu) {
            mu = dist_[x] + nd;
            meetU = x;
            meetV = u;
          }
        }
      }
    }
    if (meetU < 0) return;
    tracePath(meetU);
    out.path.assign(pathTmp_.rbegin(), pathTmp_.rend());
    for (int32_t v = meetV; v >= 0; v = parentB_[v]) out.path.push_back(v);
    finishPath(out);
  }

  const Graph& g_;
  MinHeap heapF_;
  MinHeap heapB_;
  std::vector<double> dist_;
  std::vector<double> distB_;
  std::vector<int32_t> parent_;
  std::vector<int32_t> parentB_;
  std::vector<uint8_t> settled_;
  std::vector<uint8_t> settledB_;
  std::vector<int32_t> queue_;
  std::vector<int32_t> pathTmp_;
};

}  // namespace mg
