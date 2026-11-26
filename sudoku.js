// Sudoku generator, solver and difficulty grader.
const Sudoku = (() => {
  const ALL = 0x1ff;
  const UNITS = [];
  for (let r = 0; r < 9; r++) UNITS.push([...Array(9)].map((_, c) => r * 9 + c));
  for (let c = 0; c < 9; c++) UNITS.push([...Array(9)].map((_, r) => r * 9 + c));
  for (let b = 0; b < 9; b++) {
    const r0 = Math.floor(b / 3) * 3, c0 = (b % 3) * 3;
    UNITS.push([...Array(9)].map((_, k) => (r0 + Math.floor(k / 3)) * 9 + c0 + (k % 3)));
  }
  const rowOf = (i) => Math.floor(i / 9);
  const colOf = (i) => i % 9;
  const boxOf = (i) => Math.floor(rowOf(i) / 3) * 3 + Math.floor(colOf(i) / 3);
  const PEERS = [...Array(81)].map((_, i) => {
    const s = new Set([...UNITS[rowOf(i)], ...UNITS[9 + colOf(i)], ...UNITS[18 + boxOf(i)]]);
    s.delete(i);
    return [...s];
  });
  const bitCount = (m) => { let n = 0; while (m) { m &= m - 1; n++; } return n; };
  const lowDigit = (m) => 31 - Math.clz32(m & -m) + 1;
  const digitsOf = (m) => { const d = []; for (let k = 1; k <= 9; k++) if (m & (1 << (k - 1))) d.push(k); return d; };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // Backtracking search; returns number of solutions found (up to limit). Fills `out` with the first.
  function search(grid, limit, randomize, out) {
    const g = Int8Array.from(grid);
    const rows = new Uint16Array(9), cols = new Uint16Array(9), boxes = new Uint16Array(9);
    for (let i = 0; i < 81; i++) {
      if (!g[i]) continue;
      const b = 1 << (g[i] - 1);
      if ((rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]) & b) return 0;
      rows[rowOf(i)] |= b; cols[colOf(i)] |= b; boxes[boxOf(i)] |= b;
    }
    let count = 0;
    const rec = () => {
      let best = -1, bestMask = 0, bestN = 10;
      for (let i = 0; i < 81; i++) {
        if (g[i]) continue;
        const m = ALL & ~(rows[rowOf(i)] | cols[colOf(i)] | boxes[boxOf(i)]);
        const n = bitCount(m);
        if (n < bestN) { best = i; bestMask = m; bestN = n; if (n <= 1) break; }
      }
      if (best < 0) {
        if (count === 0 && out) out.set(g);
        return ++count >= limit;
      }
      if (!bestMask) return false;
      const ds = digitsOf(bestMask);
      if (randomize) shuffle(ds);
      const r = rowOf(best), c = colOf(best), bx = boxOf(best);
      for (const d of ds) {
        const b = 1 << (d - 1);
        g[best] = d; rows[r] |= b; cols[c] |= b; boxes[bx] |= b;
        if (rec()) return true;
        g[best] = 0; rows[r] &= ~b; cols[c] &= ~b; boxes[bx] &= ~b;
      }
      return false;
    };
    rec();
    return count;
  }

  const countSolutions = (grid, limit = 2) => search(grid, limit, false, null);
  function solve(grid) {
    const out = new Int8Array(81);
    return search(grid, 1, false, out) ? Array.from(out) : null;
  }
  function randomSolution() {
    const out = new Int8Array(81);
    search(new Int8Array(81), 1, true, out);
    return Array.from(out);
  }

  // Human-style solver. Returns the hardest technique tier needed:
  // 1 = singles, 2 = locked candidates / pairs, Infinity = needs guessing.
  function grade(grid, maxTier = 2) {
    const val = Int8Array.from(grid);
    const cand = new Uint16Array(81);
    for (let i = 0; i < 81; i++) {
      if (val[i]) continue;
      let m = ALL;
      for (const p of PEERS[i]) if (val[p]) m &= ~(1 << (val[p] - 1));
      cand[i] = m;
    }
    const place = (i, d) => {
      val[i] = d; cand[i] = 0;
      const b = ~(1 << (d - 1));
      for (const p of PEERS[i]) cand[p] &= b;
    };
    let tier = 0;
    for (;;) {
      let empty = 0, progress = false;
      for (let i = 0; i < 81; i++) {
        if (val[i]) continue;
        empty++;
        if (!cand[i]) return Infinity;
        if (bitCount(cand[i]) === 1) { place(i, lowDigit(cand[i])); progress = true; }
      }
      if (!empty) return tier;
      if (progress) { tier = Math.max(tier, 1); continue; }
      for (const u of UNITS) {
        for (let d = 1; d <= 9; d++) {
          const b = 1 << (d - 1);
          let pos = -1, n = 0;
          for (const i of u) if (cand[i] & b) { pos = i; n++; }
          if (n === 1) { place(pos, d); progress = true; }
        }
      }
      if (progress) { tier = Math.max(tier, 1); continue; }
      if (maxTier < 2) return Infinity;
      if (eliminate(cand)) { tier = 2; continue; }
      return Infinity;
    }
  }

  function eliminate(cand) {
    let changed = false;
    const strip = (cells, mask, keep) => {
      for (const i of cells) {
        if (keep.includes(i) || !(cand[i] & mask)) continue;
        cand[i] &= ~mask; changed = true;
      }
    };
    // Locked candidates (pointing and claiming).
    for (let u = 0; u < 27; u++) {
      for (let d = 1; d <= 9; d++) {
        const b = 1 << (d - 1);
        const pos = UNITS[u].filter((i) => cand[i] & b);
        if (pos.length < 2) continue;
        if (u >= 18) {
          if (pos.every((i) => rowOf(i) === rowOf(pos[0]))) strip(UNITS[rowOf(pos[0])], b, pos);
          if (pos.every((i) => colOf(i) === colOf(pos[0]))) strip(UNITS[9 + colOf(pos[0])], b, pos);
        } else if (pos.every((i) => boxOf(i) === boxOf(pos[0]))) {
          strip(UNITS[18 + boxOf(pos[0])], b, pos);
        }
      }
    }
    if (changed) return true;
    // Naked pairs.
    for (const u of UNITS) {
      for (let a = 0; a < 9; a++) {
        const m = cand[u[a]];
        if (bitCount(m) !== 2) continue;
        for (let k = a + 1; k < 9; k++) {
          if (cand[u[k]] === m) strip(u, m, [u[a], u[k]]);
        }
      }
    }
    if (changed) return true;
    // Hidden pairs.
    for (const u of UNITS) {
      const where = [];
      for (let d = 1; d <= 9; d++) where.push(u.filter((i) => cand[i] & (1 << (d - 1))));
      for (let d1 = 0; d1 < 9; d1++) {
        if (where[d1].length !== 2) continue;
        for (let d2 = d1 + 1; d2 < 9; d2++) {
          const w = where[d2];
          if (w.length !== 2 || w[0] !== where[d1][0] || w[1] !== where[d1][1]) continue;
          const keep = (1 << d1) | (1 << d2);
          for (const i of w) if (cand[i] & ~keep) { cand[i] &= keep; changed = true; }
        }
      }
    }
    return changed;
  }

  const LEVELS = {
    easy: { minClues: 45, maxTier: 1, wantTier: 1 },
    medium: { minClues: 38, maxTier: 1, wantTier: 1 },
    hard: { minClues: 30, maxTier: 1, wantTier: 1 },
    expert: { minClues: 25, maxTier: 2, wantTier: 2 },
  };

  function dig(solution, cfg) {
    const puzzle = solution.slice();
    let clues = 81;
    const order = shuffle([...Array(41).keys()]);
    for (const i of order) {
      const pair = i === 40 ? [40] : [i, 80 - i];
      if (clues - pair.length < cfg.minClues) continue;
      for (const p of pair) puzzle[p] = 0;
      const ok = countSolutions(puzzle, 2) === 1 && (cfg.maxTier === Infinity || grade(puzzle, cfg.maxTier) <= cfg.maxTier);
      if (ok) clues -= pair.length;
      else for (const p of pair) puzzle[p] = solution[p];
    }
    return { puzzle, clues };
  }

  // Builds a symmetric puzzle with a unique solution, graded to the requested difficulty.
  function generate(level = "medium", budgetMs = 2500) {
    const cfg = LEVELS[level] || LEVELS.medium;
    const start = Date.now();
    let best = null;
    do {
      const solution = randomSolution();
      const { puzzle, clues } = dig(solution, cfg);
      const tier = grade(puzzle, 2);
      const score = (tier === cfg.wantTier ? 1000 : 0) - clues;
      if (!best || score > best.score) best = { puzzle, solution, clues, tier, score };
      if (tier === cfg.wantTier && (clues <= cfg.minClues + 2 || Date.now() - start > 400)) break;
    } while (Date.now() - start < budgetMs);
    return { level, puzzle: best.puzzle, solution: best.solution, clues: best.clues, tier: best.tier };
  }

  return { generate, solve, countSolutions, grade, PEERS, UNITS, rowOf, colOf, boxOf };
})();
if (typeof module !== "undefined") module.exports = Sudoku;
