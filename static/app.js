(() => {
  const $ = (s) => document.querySelector(s);
  const KEY = "sudoku.v1";
  // Each puzzle uses 9 random Sol letters (github.com/menehune23/sol), shown in Sol order.
  const SOL_ORDER = Object.keys(window.SOL.glyphs);
  const pickSym = () => {
    const pool = SOL_ORDER.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return [null, ...pool.slice(0, 9).sort((a, b) => SOL_ORDER.indexOf(a) - SOL_ORDER.indexOf(b))];
  };
  let SYM = [null, "h", "a", "e", "w", "o", "oo", "y", "ee", "ey"];
  const symSVG = (d) => {
    return `<svg class="sym" viewBox="${window.SOL.box.join(" ")}" aria-hidden="true"><path transform="scale(1,-1)" d="${window.SOL.glyphs[SYM[d]]}"/></svg>`;
  };
  const BEST_KEY = "sudoku.best";
  const STREAK_KEY = "sudoku.streak";
  const breakStreak = () => {
    const st = store.get(STREAK_KEY, {});
    if (st[S.level]) { st[S.level] = 0; store.set(STREAK_KEY, st); }
  };
  const LEVELS = [
    ["easy", "Easy", 1, "Most cells filled · gentle start"],
    ["medium", "Medium", 2, "Lots of clues · singles only"],
    ["hard", "Hard", 3, "Fewer clues · hidden singles"],
    ["expert", "Expert", 4, "Needs pairs & locked candidates"],
  ];
  const COLORS = [
    ["signal", "Signal", "#E5533D"],
    ["ember", "Oxide", "#DE8A33"],
    ["sand", "Dune", "#C9B58C"],
    ["lime", "Phosphor", "#A9BA35"],
    ["patina", "Aurora", "#4FB89F"],
    ["ion", "Ion", "#5B9EE6"],
    ["nebula", "Nebula", "#A57BE8"],
    ["flare", "Flare", "#E56BAA"],
    ["steel", "Lunar", "#A1A1A1"],
  ];
  const levelName = (id) => (LEVELS.find((l) => l[0] === id) || LEVELS[1])[1];

  let S = null;
  let selected = -1;
  let notesMode = false;
  let previewKey = 0;
  let pendingLevel = "medium";
  const settings = { timer: true, errors: true, hints: true, sol: true, autoNotes: true };
  const SOLAT = {
    h: "[h]ot", a: "[a]pple", e: "p[e]t", i: "s[i]t", ah: "h[o]t", u: "h[u]t", uu: "p[u]t",
    w: "[w]et", o: "n[o]", oo: "f[oo]d", y: "[y]es", ee: "m[ee]t", ey: "n[a]me", ahy: "l[i]ke", yoo: "h[u]ge",
    b: "[b]uy", p: "[p]ay", d: "[d]ay", j: "[j]am", jh: "fu[si]on", t: "[t]en", thh: "[th]is", tth: "[th]ink",
    f: "[f]ar", v: "[v]ast", g: "[g]o", k: "[k]aya[k]", l: "[l]it", m: "[m]y", n: "[n]o", r: "[r]est",
    s: "[s]ay", z: "[z]oo", sh: "[sh]oe", ch: "[ch]at",
  };

  const store = {
    get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
  };
  const save = () => store.set(KEY, S);
  Object.assign(settings, store.get("sudoku.settings", {}));
  const fmt = (sec) => {
    sec = Math.min(Math.floor(sec), 359999);
    const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    const mm = String(m).padStart(2, "0"), ss = String(s).padStart(2, "0");
    return h ? `${String(h).padStart(2, "0")}:${mm}:${ss}` : `${mm}:${ss}`;
  };

  // Board
  const boardEl = $("#board");
  const cells = [];
  for (let i = 0; i < 81; i++) {
    const r = Math.floor(i / 9), c = i % 9;
    const el = document.createElement("button");
    el.className = `cell r${r} c${c}`;
    el.type = "button";
    el.dataset.i = i;
    el.setAttribute("role", "gridcell");
    el.innerHTML = `<span class="v"></span><div class="notes" aria-hidden="true">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<span>${symSVG(d)}</span>`).join("")}</div>`;
    el.addEventListener("click", () => tapCell(i));
    boardEl.appendChild(el);
    cells.push(el);
  }

  // Pad
  const padEl = $("#pad");
  const keys = [];
  for (let d = 1; d <= 9; d++) {
    const k = document.createElement("button");
    k.className = "key";
    k.type = "button";
    k.innerHTML = `<b>${symSVG(d)}</b>`;
    k.setAttribute("aria-label", `Enter ${SYM[d]}`);
    k.addEventListener("click", () => keyTap(d));
    padEl.appendChild(k);
    keys.push(k);
  }

  let paintedSym = null;
  function paintSymbols() {
    SYM = S.sym;
    paintedSym = S.sym;
    for (const el of cells) {
      el.firstChild.dataset.v = "";
      [...el.lastChild.children].forEach((n, idx) => { n.innerHTML = symSVG(idx + 1); });
    }
    keys.forEach((k, idx) => { k.firstChild.innerHTML = symSVG(idx + 1); });
  }

  function render() {
    if (!S) return;
    if (!Array.isArray(S.sym) || S.sym.length !== 10 || S.sym.slice(1).some((s) => !window.SOL.glyphs[s])) S.sym = SYM;
    if (paintedSym !== S.sym) paintSymbols();
    const { puzzle, solution, values, notes, hinted } = S;
    const selVal = selected >= 0 ? values[selected] : 0;
    if (!settings.sol || notesMode || selected >= 0 || S.done) previewKey = 0;
    const hiVal = selVal || previewKey;
    const peers = new Set(selected >= 0 ? Sudoku.PEERS[selected] : []);
    for (let i = 0; i < 81; i++) {
      const el = cells[i], v = values[i];
      const given = puzzle[i] !== 0;
      el.classList.toggle("given", given);
      el.classList.toggle("wrong", settings.errors && !given && v !== 0 && v !== solution[i]);
      el.classList.toggle("hint", hinted.includes(i));
      el.classList.toggle("sel", i === selected);
      el.classList.toggle("peer", peers.has(i));
      el.classList.toggle("same", i !== selected && hiVal !== 0 && v === hiVal);
      if (el.firstChild.dataset.v !== String(v)) {
        el.firstChild.dataset.v = v;
        el.firstChild.innerHTML = v ? symSVG(v) : "";
      }
      const noteEls = el.lastChild.children;
      for (let d = 1; d <= 9; d++) {
        const on = !v && (notes[i] & (1 << (d - 1)));
        noteEls[d - 1].classList.toggle("on", Boolean(on));
        noteEls[d - 1].classList.toggle("match", Boolean(on) && d === hiVal);
      }
      const r = Math.floor(i / 9) + 1, c = (i % 9) + 1;
      el.setAttribute("aria-label", `Row ${r}, column ${c}, ${v ? SYM[v] : "empty"}${given ? ", given" : ""}`);
    }
    const counts = Array(10).fill(0);
    for (let i = 0; i < 81; i++) if (values[i] && (!settings.errors || values[i] === solution[i])) counts[values[i]]++;
    keys.forEach((k, idx) => {
      const left = 9 - counts[idx + 1];
      k.classList.toggle("complete", left === 0);
    });
    $("#stat-level").textContent = levelName(S.level);
    const mEl = $("#stat-mistakes");
    mEl.textContent = S.mistakes;
    mEl.classList.toggle("bad", S.mistakes > 0);
    $("#time-block").hidden = !settings.timer;
    $("#err-block").hidden = !settings.errors;
    const solKey = settings.sol && hiVal ? S.sym[hiVal] : null;
    $("#sol-block").hidden = !settings.sol;
    $("#info-text").hidden = settings.sol;
    $("#stat-sol").textContent = solKey || "—";
    $("#stat-sol-ex").innerHTML = solKey ? "<i>as in</i> " + SOLAT[solKey].replace(/\[([^\]]+)\]/g, "<b>$1</b>") : "";
    $("#hint-count").textContent = S.hints ? S.hints : "";
    $("#undo").disabled = !S.history.length || S.done;
    $("#app").classList.toggle("solved", S.done);
    $("#hint").hidden = !settings.hints;
    padEl.classList.toggle("notes-on", notesMode);
    const sel = selected >= 0 ? selected : null;
    const givenSel = sel !== null && puzzle[sel] !== 0;
    const filledSel = sel !== null && values[sel] !== 0;
    const locked = S.done || givenSel || (notesMode && filledSel);
    const clearNotes = sel !== null && !givenSel && !filledSel && Boolean(notes[sel]);
    const showClear = notesMode || (clearNotes && !S.done);
    $("#erase").disabled = S.done || !(clearNotes || (!notesMode && filledSel && !givenSel));
    $("#erase").classList.toggle("clear-notes", showClear);
    $("#erase span").textContent = showClear ? "Clear notes" : "Delete";
    $("#notes").disabled = S.done || sel === null || givenSel || filledSel;
    const keyHi = !notesMode && !S.done ? hiVal : 0;
    keys.forEach((k, idx) => {
      const on = notesMode && sel !== null && !locked && Boolean(notes[sel] & (1 << idx));
      k.classList.toggle("noted", on);
      k.classList.toggle("locked", locked);
      k.classList.toggle("preview", keyHi === idx + 1);
      k.setAttribute("aria-pressed", notesMode ? String(on) : String(keyHi === idx + 1));
      k.setAttribute("aria-label", notesMode ? `${on ? "Remove" : "Add"} note ${SYM[idx + 1]}` : `Enter ${SYM[idx + 1]}`);
    });
    renderTime();
  }

  function renderTime() {
    if (S) $("#stat-time").textContent = fmt(S.elapsed);
  }

  function keyTap(d) {
    if (S && !S.done && selected < 0 && settings.sol && !notesMode) {
      previewKey = d;
      render();
    } else input(d);
  }

  function deselect() {
    if (selected < 0 && !previewKey) return;
    previewKey = selected >= 0 && S && settings.sol ? S.values[selected] : 0;
    selected = -1;
    notesMode = false;
    $("#notes").setAttribute("aria-pressed", "false");
    render();
  }

  let lastTap = { i: -1, t: 0 };
  function tapCell(i) {
    const now = performance.now();
    const empty = S && !S.done && !S.puzzle[i] && !S.values[i];
    if (empty && lastTap.i === i && now - lastTap.t < 350) {
      lastTap.i = -1;
      if (selected !== i) select(i);
      notesMode = true;
      $("#notes").setAttribute("aria-pressed", String(notesMode));
      render();
      return;
    }
    if (selected === i) deselect(); else select(i);
    lastTap = { i, t: now };
  }

  function select(i) {
    const same = selected === i;
    selected = i;
    previewKey = 0;
    if (!same && S && !S.done && !S.puzzle[i] && !S.values[i]) {
      notesMode = Boolean(S.notes[i]);
      $("#notes").setAttribute("aria-pressed", String(notesMode));
    }
    render();
  }

  const snapshot = () => ({ v: S.values.slice(), n: S.notes.slice() });
  function pushHistory() {
    S.history.push(snapshot());
    if (S.history.length > 300) S.history.shift();
  }

  function clearPeerNotes(i, d) {
    if (!settings.autoNotes) return;
    const b = ~(1 << (d - 1));
    for (const p of Sudoku.PEERS[i]) S.notes[p] &= b;
  }

  function input(d) {
    if (!S || S.done || selected < 0) return;
    const i = selected;
    if (S.puzzle[i]) return;
    if (notesMode) {
      if (S.values[i]) return;
      pushHistory();
      S.notes[i] ^= 1 << (d - 1);
    } else {
      if (S.values[i] === d) return;
      pushHistory();
      S.values[i] = d;
      S.notes[i] = 0;
      if (d !== S.solution[i]) { S.mistakes++; breakStreak(); }
      if (d === S.solution[i] || !settings.errors) clearPeerNotes(i, d);
    }
    afterMove();
  }

  function erase() {
    if (!S || S.done || selected < 0 || S.puzzle[selected]) return;
    if (!S.values[selected] && !S.notes[selected]) return;
    if (notesMode && S.values[selected]) return;
    pushHistory();
    if (S.values[selected]) S.values[selected] = 0;
    else S.notes[selected] = 0;
    afterMove();
  }

  function undo() {
    if (!S || S.done || !S.history.length) return;
    const h = S.history.pop();
    S.values = h.v;
    S.notes = h.n;
    afterMove();
  }

  function hint() {
    if (!S || S.done) return;
    let i = selected;
    if (i < 0 || S.puzzle[i] || S.values[i] === S.solution[i]) {
      const open = [];
      for (let k = 0; k < 81; k++) if (S.values[k] !== S.solution[k]) open.push(k);
      if (!open.length) return;
      // Prefer the most constrained open cell so the hint is a useful foothold.
      const score = (k) => Sudoku.PEERS[k].filter((p) => S.values[p] && S.values[p] === S.solution[p]).length;
      const max = Math.max(...open.map(score));
      const top = open.filter((k) => score(k) === max);
      i = top[Math.floor(Math.random() * top.length)];
    }
    pushHistory();
    S.values[i] = S.solution[i];
    S.notes[i] = 0;
    clearPeerNotes(i, S.solution[i]);
    S.hints++;
    breakStreak();
    if (!S.hinted.includes(i)) S.hinted.push(i);
    selected = i;
    cells[i].classList.remove("flash");
    void cells[i].offsetWidth;
    cells[i].classList.add("flash");
    afterMove();
  }

  function afterMove() {
    if (S.values.every((v, i) => v === S.solution[i])) win();
    save();
    render();
  }

  const starSVG = (label) =>
    `<svg class="star" viewBox="0 0 24 24" ${label ? `role="img" aria-label="${label}"` : 'aria-hidden="true"'}><path d="M12 1.5l3.1 6.9 7.4.8-5.5 5 1.6 7.3L12 17.7l-6.6 3.8 1.6-7.3-5.5-5 7.4-.8z"/></svg>`;

  function fillResults() {
    const prev = S.prevBest;
    const record = !S.hints && (!prev || Math.floor(S.elapsed) < prev);
    const flawless = !S.hints && !S.mistakes;
    const streak = flawless && S.streak;
    const row = ([k, v, hl]) => `<div class="stat${hl ? " starred" : ""}"><dt>${k}</dt><dd class="${hl ? "record" : ""}"><span>${v}</span>${hl ? starSVG(hl) : ""}</dd></div>`;
    $("#win-stats").innerHTML = [
      [["Level", levelName(S.level)]],
      [["Time", fmt(S.elapsed), record && "new record"], ["Previous best", prev ? fmt(prev) : "—"]],
      [["Errors", S.mistakes, flawless && "flawless"], ["Hints used", S.hints], streak && ["Flawless streak", streak]],
    ]
      .map((group) => group.filter(Boolean).map(row).join(""))
      .join('<div class="stat-div" role="separator"></div>');
    $("#win-note").hidden = !S.hints;
    $("#win-title").textContent = record && flawless ? "New record • Flawless" : record ? "New record" : flawless ? "Flawless" : "Grid solved";
  }

  function win() {
    S.done = true;
    S.history = [];
    const best = store.get(BEST_KEY, {});
    const prev = best[S.level];
    S.prevBest = prev ?? null;
    const t = Math.floor(S.elapsed);
    if (!S.hints && (!prev || t < prev)) {
      best[S.level] = t;
      store.set(BEST_KEY, best);
    }
    if (!S.hints && !S.mistakes) {
      const st = store.get(STREAK_KEY, {});
      S.streak = st[S.level] = (st[S.level] || 0) + 1;
      store.set(STREAK_KEY, st);
    }
    fillResults();
    selected = -1;
    setTimeout(() => $("#win-sheet").showModal(), 500);
  }

  function newGame(level) {
    $("#loading").hidden = false;
    setTimeout(() => {
      const g = Sudoku.generate(level);
      S = {
        level,
        puzzle: g.puzzle,
        solution: g.solution,
        clues: g.clues,
        sym: pickSym(),
        values: g.puzzle.slice(),
        notes: Array(81).fill(0),
        hinted: [],
        history: [],
        mistakes: 0,
        hints: 0,
        elapsed: 0,
        done: false,
      };
      store.set("sudoku.level", level);
      selected = -1;
      notesMode = false;
      $("#notes").setAttribute("aria-pressed", "false");
      save();
      render();
      $("#loading").hidden = true;
    }, 60);
  }

  // Timer
  let last = performance.now();
  setInterval(() => {
    const now = performance.now();
    const dt = (now - last) / 1000;
    last = now;
    const paused = document.hidden || document.querySelector("dialog[open]") || !$("#loading").hidden;
    if (!S || S.done || paused) return;
    S.elapsed += Math.min(dt, 2);
    renderTime();
    if (Math.floor(S.elapsed) % 5 === 0) save();
  }, 500);
  document.addEventListener("visibilitychange", () => { last = performance.now(); if (document.hidden) save(); });
  window.addEventListener("pagehide", () => { if (S) save(); });

  // Sheets
  function closeSheet(dlg, after) {
    if (!dlg.open || dlg.classList.contains("closing")) return;
    dlg.classList.add("closing");
    setTimeout(() => {
      dlg.close();
      dlg.classList.remove("closing");
      if (after) after();
    }, 220);
  }
  document.querySelectorAll("dialog").forEach((dlg) => {
    dlg.addEventListener("click", (e) => {
      if (e.target === dlg || e.target.closest("[data-close]")) closeSheet(dlg);
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); closeSheet(dlg); });
    const body = document.createElement("div");
    body.className = "sheet-body";
    dlg.querySelector(".sheet-head").after(body);
    while (body.nextElementSibling && !body.nextElementSibling.matches(".sheet-actions")) body.append(body.nextElementSibling);
    const fit = () => {
      const max = body.scrollHeight - body.clientHeight;
      dlg.classList.toggle("scrolls", max > 1);
      dlg.classList.toggle("scrolled", max > 1 && body.scrollTop > 1);
      dlg.classList.toggle("more", max > 1 && body.scrollTop < max - 1);
    };
    const ro = new ResizeObserver(fit);
    ro.observe(body);
    [...body.children].forEach((c) => ro.observe(c));
    body.addEventListener("scroll", fit, { passive: true });
    let drag = null;
    dlg.addEventListener("pointerdown", (e) => {
      if (e.button > 0 || !e.target.closest(".sheet-head")) return;
      drag = { id: e.pointerId, y: e.clientY, t: e.timeStamp, dy: 0 };
      dlg.style.transition = "none";
    });
    window.addEventListener("pointermove", (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      dlg.style.transform = `translateY(${drag.dy}px)`;
      dlg.style.setProperty("--scrim", String(1 - Math.min(drag.dy / dlg.offsetHeight, 1)));
    });
    const endDrag = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const { dy, t } = drag;
      drag = null;
      dlg.style.transition = "";
      dlg.style.transform = "";
      dlg.style.removeProperty("--scrim");
      const flick = dy > 30 && dy / Math.max(e.timeStamp - t, 1) > 0.5;
      if (dy > 90 || flick || (dy < 6 && e.target.closest(".grabber"))) closeSheet(dlg);
    };
    window.addEventListener("pointerup", endDrag);
    window.addEventListener("pointercancel", endDrag);
  });

  function renderLevels() {
    const best = store.get(BEST_KEY, {});
    const streaks = store.get(STREAK_KEY, {});
    $("#levels").innerHTML = LEVELS.map(
      ([id, name, pips, desc]) => `<button type="button" class="level-option" role="radio" data-level="${id}" aria-checked="${id === pendingLevel}">
        <span class="pips">${[1, 2, 3, 4].map((n) => `<i class="${n <= pips ? "on" : ""}"></i>`).join("")}</span>
        <span><strong>${name}</strong><small>${desc}</small></span>
        <dl class="best"><dt>Best time</dt><dd>${best[id] ? fmt(best[id]) : "—"}</dd><dt>Flawless streak</dt><dd>${streaks[id] || 0}</dd></dl>
      </button>`
    ).join("");
    $("#levels").querySelectorAll(".level-option").forEach((b) =>
      b.addEventListener("click", () => { pendingLevel = b.dataset.level; renderLevels(); })
    );
  }
  function openNew() {
    pendingLevel = S ? S.level : store.get("sudoku.level", "medium");
    renderLevels();
    $("#new-sheet").showModal();
  }
  $("#open-new").addEventListener("click", openNew);
  $("#start").addEventListener("click", () => closeSheet($("#new-sheet"), () => newGame(pendingLevel)));
  $("#solved-btn").addEventListener("click", () => { fillResults(); $("#win-sheet").showModal(); });
  $("#win-new").addEventListener("click", () => closeSheet($("#win-sheet"), openNew));

  function resetGame() {
    Object.assign(S, {
      values: S.puzzle.slice(),
      notes: Array(81).fill(0),
      hinted: [],
      history: [],
      mistakes: 0,
      hints: 0,
      elapsed: 0,
      done: false,
    });
    selected = -1;
    notesMode = false;
    $("#notes").setAttribute("aria-pressed", "false");
    save();
    render();
    renderTime();
  }
  $("#open-reset").addEventListener("click", () => { if (S) $("#reset-sheet").showModal(); });
  $("#do-reset").addEventListener("click", () => closeSheet($("#reset-sheet"), resetGame));

  function setHue(id) {
    document.documentElement.dataset.hue = id;
    store.set("sudoku.hue", id);
    try { localStorage.setItem("sudoku.hue", id); } catch {}
    renderHues();
  }
  function renderHues() {
    const cur = document.documentElement.dataset.hue || "ember";
    $("#hues").innerHTML = COLORS.map(
      ([id, name, hex]) => `<button type="button" class="hue" role="radio" data-color="${id}" aria-label="${name}" title="${name}" aria-checked="${id === cur}" style="--swatch:${hex}"></button>`
    ).join("");
    $("#hue-name").textContent = (COLORS.find((c) => c[0] === cur) || COLORS[0])[1];
    $("#hues").querySelectorAll(".hue").forEach((b) => b.addEventListener("click", () => setHue(b.dataset.color)));
  }
  $("#open-hue").addEventListener("click", () => {
    renderHues();
    $("#set-timer").checked = settings.timer;
    $("#set-errors").checked = settings.errors;
    $("#set-hints").checked = settings.hints;
    $("#set-sol").checked = settings.sol;
    $("#set-autonotes").checked = settings.autoNotes;
    $("#hue-sheet").showModal();
  });
  [["#set-timer", "timer"], ["#set-errors", "errors"], ["#set-hints", "hints"], ["#set-sol", "sol"], ["#set-autonotes", "autoNotes"]].forEach(([sel, key]) =>
    $(sel).addEventListener("change", (e) => {
      settings[key] = e.target.checked;
      store.set("sudoku.settings", settings);
      render();
    })
  );

  // Tools
  $("#undo").addEventListener("click", undo);
  $("#erase").addEventListener("click", erase);
  $("#hint").addEventListener("click", hint);
  const toggleNotes = () => {
    if ($("#notes").disabled) return;
    notesMode = !notesMode;
    $("#notes").setAttribute("aria-pressed", String(notesMode));
    render();
  };
  $("#notes").addEventListener("click", toggleNotes);

  document.addEventListener("keydown", (e) => {
    if (document.querySelector("dialog[open]") || !S) return;
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") { e.preventDefault(); undo(); return; }
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    if (/^[1-9]$/.test(e.key)) { keyTap(Number(e.key)); return; }
    if (e.key === "Escape") { deselect(); return; }
    if (["Backspace", "Delete", "0"].includes(e.key)) { erase(); return; }
    if (e.key.toLowerCase() === "n") { toggleNotes(); return; }
    if (e.key.toLowerCase() === "h") { if (settings.hints) hint(); return; }
    const moves = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
    if (moves[e.key] !== undefined) {
      e.preventDefault();
      if (selected < 0) { select(40); return; }
      const r = Math.floor(selected / 9), c = selected % 9;
      const nr = (r + (e.key === "ArrowUp" ? -1 : e.key === "ArrowDown" ? 1 : 0) + 9) % 9;
      const nc = (c + (e.key === "ArrowLeft" ? -1 : e.key === "ArrowRight" ? 1 : 0) + 9) % 9;
      select(nr * 9 + nc);
    }
  });

  document.addEventListener("click", (e) => {
    if (document.querySelector("dialog[open]")) return;
    if (e.target.closest("button, a, input, label, dialog, #board, #pad")) return;
    deselect();
  });

  // Boot
  const saved = store.get(KEY, null);
  if (saved && Array.isArray(saved.puzzle) && saved.puzzle.length === 81) {
    S = { hinted: [], history: [], hints: 0, mistakes: 0, ...saved };
    if (S.done && S.prevBest === undefined) {
      const best = store.get(BEST_KEY, {})[S.level];
      S.prevBest = !S.hints && S.record !== false && best === Math.floor(S.elapsed) ? null : best ?? null;
    }
    delete S.record;
    render();
  } else {
    newGame(store.get("sudoku.level", "easy"));
  }
})();

if (!/\.devinapps\.com$|^localhost$|^127\./.test(location.hostname)) document.getElementById("request-link")?.remove();

document.addEventListener("touchmove", (e) => {
  const dlg = document.querySelector("dialog[open]");
  if (!dlg) return;
  const body = e.target.closest?.(".sheet-body");
  if (body && dlg.contains(body) && body.scrollHeight > body.clientHeight) return;
  e.preventDefault();
}, { passive: false });
