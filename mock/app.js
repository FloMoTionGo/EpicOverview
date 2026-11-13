/* Renders the static mock from window.MOCK (data.js) and window.ASSETS (assets/assets.js). */
(function () {
  "use strict";
  const M = window.MOCK;
  const A = window.ASSETS;
  const $ = (sel, el = document) => el.querySelector(sel);
  const F = Object.fromEntries(M.factions.map((f) => [f.id, f]));
  const ROMAN = ["", "I", "II", "III", "IV"];

  /* ---------- asset helpers */
  const allCards = Object.values(A.cards).flat();
  const cardById = (id) => allCards.find((c) => c.id === id);
  const westerosCard = (deck, name, value) =>
    A.cards.westeros.find((c) => c.deck === deck && c.name === name && (value == null || c.value === value)) ||
    A.cards.westeros.find((c) => c.deck === deck && c.name === name);

  const sigil = (id, size = 32, cls = "sigil") =>
    `<img class="${cls}" src="${A.sigils[F[id].sigil]}" alt="${F[id].name}" width="${size}" height="${size}">`;
  const cardImg = (c, cls = "card") =>
    c ? `<img class="${cls}" src="${c.thumb}" data-zoom="${c.zoom}" alt="${c.name || c.house || "card"}" loading="lazy">` : "";
  const token = (key, cls = "token") => `<img class="${cls}" src="${A.tokens[key]}" alt="">`;
  const names = (ids) => ids.map((id) => F[id].name).join(", ").replace(/, ([^,]*)$/, " and $1");

  /* ---------- masthead */
  function renderMasthead() {
    let s = "";
    for (let r = 1; r <= 12; r++) {
      const cls = r < M.round ? "past" : r === M.round ? "now" : "";
      s += `<span class="seal ${cls}" ${r === M.round ? 'aria-current="true"' : ""} title="Round ${r}">${r}</span>`;
    }
    s += `<span class="round-label"><strong>Round ${M.round}</strong><span>of 12</span></span>`;
    $("#seals").innerHTML = s;

    const idx = M.phases.findIndex((p) => p.id === M.phase);
    $("#ribbon").innerHTML = M.phases
      .map((p, i) => `<li class="${i < idx ? "past" : i === idx ? "now" : ""}" ${i === idx ? 'aria-current="step"' : ""}>${p.name}</li>`)
      .join("");

    const t = M.tokens;
    $("#holders").innerHTML = [
      ["Iron Throne", t.throne],
      ["Blade", t.blade],
      ["Raven", t.raven]
    ]
      .map(([label, id]) => `<div class="holder">${sigil(id, 34)}<span>${label}<b>${F[id].name}</b></span></div>`)
      .join("");
  }

  /* ---------- table view */
  function renderTable() {
    const C = M.checklist;
    const step = C.steps[C.current];
    const level = (a, b) => (M.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a)) || {}).level || 0;

    const steps = `
      <div class="steps">
        <h2>${C.title}</h2>
        <ol>${C.steps
          .map(
            (s, i) => `<li class="${s.done ? "done" : ""} ${i === C.current ? "current" : ""}">
              <button type="button" data-step="${i}"><span class="dot">${s.done ? "✓" : i + 1}</span><span>${s.title}</span></button></li>`
          )
          .join("")}</ol>
        <p class="next-phase">Next phase: Planning</p>
      </div>`;

    const waiting = C.waiting
      .map(
        (w) => `<li class="${w.state}">
          <span class="who">${w.who.map((id) => sigil(id, 40)).join("")}</span>
          <span>${w.task}<span class="names">${names(w.who)}</span></span>
          <span class="state ${w.state}">${{ open: "Needs answer", waiting: "Waiting", done: "Done" }[w.state]}</span>
        </li>`
      )
      .join("");

    const cond = (w) => {
      if (/^(During|Throughout|While)\b/.test(w)) return w;
      const first = w.split(" ")[0];
      return "If " + (["Someone", "Two", "A", "The", "Several", "One", "Each"].includes(first) ? w.charAt(0).toLowerCase() + w.slice(1) : w);
    };
    const rules = step.rules.map(([w, t]) => `<dt>${cond(w)}</dt><dd>${t}</dd>`).join("");
    const cards = (step.cards || []).map((id) => cardImg(cardById(id))).join("") + (step.token ? token(step.token) : "");
    const actions = (step.actions || (step.action ? [step.action] : []))
      .map((a) => `<button class="btn" type="button">${a}</button>`)
      .join("");

    const now = `
      <article class="vellum now" aria-labelledby="now-title">
        <p class="where">${C.title}, step ${C.current + 1} of ${C.steps.length}</p>
        <h1 id="now-title">${step.title}</h1>
        <ul class="waiting" aria-label="What is needed now">${waiting}</ul>
        <dl class="rules">${rules}</dl>
        ${C.reminder ? `<p class="reminder">${C.reminder}</p>` : ""}
        <div class="now-foot">
          <div><p class="source">Source: ${step.source}</p><div class="cards">${cards}</div></div>
          <div class="actions">${actions}<button class="btn primary" type="button" id="step-done">Step done, next step</button></div>
        </div>
      </article>`;

    const W = M.westeros;
    const target = W.revealed.filter((c) => c.value).reduce((s, c) => s + c.value, 0);
    const wmini = W.revealed
      .map((c) => {
        const card = westerosCard(c.deck, c.name, c.value);
        return `<figure>${cardImg(card)}<figcaption><span>Deck ${ROMAN[c.deck]}</span><span class="num">${c.value != null ? "value " + c.value : "event"}</span></figcaption></figure>`;
      })
      .join("");
    const deck4 = W.revealed.find((c) => c.deck === 4);

    const council = M.council
      .map(
        (c) => `<li><span><span class="who">${sigil(c.holder, 26)}${F[c.holder].name}</span><span class="role">${c.role}</span></span>
          <span class="used">${c.once === true ? "used this round" : c.once === false ? "ready" : ""}</span></li>`
      )
      .join("");

    const pairs = M.relations
      .slice()
      .sort((x, y) => y.level - x.level)
      .map(
        (r) => `<li>${sigil(r.a, 28)}<span class="shield l${r.level}" title="${M.levels[r.level]}">${r.level}</span>${sigil(r.b, 28)}
          <span>${M.levels[r.level]}${r.changed ? ' <span class="changed">new this round</span>' : ""}</span></li>`
      )
      .join("");

    const hostages = M.hostages
      .map((h) => `<li>${sigil(h.holder, 26)}<span>${F[h.holder].name} holds ${F[h.owner].name}'s ${h.card.toLowerCase()}</span></li>`)
      .join("");
    const sieges = M.board.sieges
      .map((s) => `<li>${sigil(s.besieger, 26)}<span>${F[s.besieger].name} besieges ${s.area} (${F[s.owner].name}) since round ${s.since}</span></li>`)
      .join("");

    const side = `
      <div class="side">
        <section class="panel"><h2>Westeros this round</h2><div class="w-mini">${wmini}</div>
          <p class="target">Round target for deck IV: <span class="num">${target}</span></p>
          ${deck4 && deck4.result ? `<p class="target muted">${deck4.result}</p>` : ""}</section>
        <section class="panel"><h2>Small Council</h2><ul class="council-list">${council}</ul>
          <p class="council-none">No seat: ${names(M.councilNone)}</p></section>
        <section class="panel"><h2>Diplomacy</h2><ul class="pairs">${pairs}</ul>
          <p class="council-none">Every other pair is at War.</p></section>
        <section class="panel"><h2>Hostages and sieges</h2><ul class="plain">${hostages}${sieges}</ul></section>
      </div>`;

    $("#view-table").innerHTML = `<div class="table-grid">${steps}${now}${side}</div>`;
  }

  /* ---------- relations view */
  function renderRelations() {
    const ids = M.factions.map((f) => f.id);
    const rel = (a, b) => M.relations.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
    const head = `<tr><th></th>${ids.map((id) => `<th scope="col">${sigil(id, 44)}</th>`).join("")}</tr>`;
    const body = ids
      .map(
        (a) => `<tr><th scope="row">${sigil(a, 44)}</th>${ids
          .map((b) => {
            if (a === b) return '<td class="self"></td>';
            const r = rel(a, b);
            return r
              ? `<td class="${r.changed ? "changed" : ""}" title="${F[a].name} and ${F[b].name}: ${M.levels[r.level]}"><span class="shield l${r.level}">${r.level}</span></td>`
              : `<td title="${F[a].name} and ${F[b].name}: War"><span class="war">War</span></td>`;
          })
          .join("")}</tr>`
      )
      .join("");

    const limits = ids
      .map((id) => {
        const mine = M.relations.filter((r) => r.a === id || r.b === id);
        const pos = mine.length;
        const al = mine.filter((r) => r.level === 2).length;
        const dy = mine.filter((r) => r.level === 3).length;
        const ring = M.ringsUsed.includes(id) ? "used" : "unused";
        return `<tr><td>${F[id].name}</td><td class="num ${pos === 3 ? "full" : ""}">${pos} / 3</td><td class="num ${al === 2 ? "full" : ""}">${al} / 2</td><td class="num ${dy === 1 ? "full" : ""}">${dy} / 1</td><td>${ring}</td></tr>`;
      })
      .join("");

    const marriages = M.marriages
      .map((m) => `<li>${token("ring")}<span>${F[m.proposer].name} and ${F[m.partner].name}, round ${m.round}${m.state === "proposed" ? " – proposed, awaiting answer" : ""}</span></li>`)
      .join("");
    const dowries = M.dowries
      .map((d) => `<figure>${cardImg(cardById(d.card))}<figcaption>${F[d.owner].name}'s dowry, now held by ${F[d.holder].name}</figcaption></figure>`)
      .join("");
    const hostages = M.hostages
      .map((h) => `<li>${token("holdingcell")}<span>${F[h.holder].name} holds ${F[h.owner].name}'s ${h.card.toLowerCase()} since round ${h.since}. Hostage income: ${F[h.holder].name} +1, ${F[h.owner].name} −1.</span></li>`)
      .join("");
    const breaks = M.breaks.map((b) => `<li>Round ${b.round}: ${F[b.who].name} broke the ${b.level} with ${F[b.with].name} and paid ${b.paid}.</li>`).join("");

    $("#view-relations").innerHTML = `
      <div class="two-col">
        <section>
          <div class="panel"><h2>Diplomatic levels</h2>
            <div class="matrix-wrap"><table class="matrix" aria-label="Diplomatic levels between houses">${head}${body}</table></div>
            <p class="legend"><span><span class="shield l1">1</span> Truce</span><span><span class="shield l2">2</span> Alliance</span><span><span class="shield l3">3</span> Dynasty</span><span>Dot: changed this round</span></p>
            <table class="limits"><tr><th>House</th><th>Positive levels</th><th>Alliances</th><th>Dynasty</th><th>Ring</th></tr>${limits}</table>
          </div>
        </section>
        <section class="side">
          <div class="panel"><h2>Marriages</h2><ul class="plain">${marriages}</ul></div>
          <div class="panel"><h2>Dowries that changed hands</h2><div class="dowries">${dowries}</div></div>
          <div class="panel"><h2>Hostages</h2><ul class="plain">${hostages}</ul></div>
          <div class="panel"><h2>Broken levels</h2><ul class="plain">${breaks}</ul></div>
        </section>
      </div>`;
  }

  /* ---------- westeros view */
  function renderWesteros() {
    const W = M.westeros;
    const decks = W.revealed
      .map((c, i) => {
        const card = westerosCard(c.deck, c.name, c.value);
        return `<section class="deck"><h3>Deck ${ROMAN[c.deck]}</h3>${cardImg(card)}
          <div class="meta"><span class="num">${W.left[i]} in deck</span><span class="num">${W.discards[i]} discarded</span></div>
          ${c.note ? `<p class="note">${c.note}</p>` : ""}${c.result ? `<p class="note">${c.result}</p>` : ""}</section>`;
      })
      .join("");
    const abilities = W.abilities
      .map((a) => {
        const btn =
          a.state === "ready"
            ? `<button class="btn primary" type="button" data-peek="${a.who}">Look at decks II and III</button>`
            : a.state === "used"
              ? `<button class="btn" type="button" disabled>${a.detail}</button>`
              : `<button class="btn" type="button" disabled>Available in Planning</button>`;
        return `<article class="vellum ability"><h3>${a.role}</h3><div class="who">${sigil(a.who, 30)}${F[a.who].name}</div><p>${a.text}</p>${btn}</article>`;
      })
      .join("");
    $("#view-westeros").innerHTML = `
      <div class="decks">${decks}</div>
      <p class="target">Round target for deck IV bids: <span class="num">${W.revealed.filter((c) => c.value).reduce((s, c) => s + c.value, 0)}</span>, the sum of the values on decks I–III. Winter is Coming shuffles its deck and draws again.</p>
      <div class="abilities">${abilities}</div>`;
  }

  /* ---------- market view */
  function renderMarket() {
    const items = M.stock
      .map((s) => {
        const pips = s.total <= 12 ? `<div class="pips" aria-hidden="true">${Array.from({ length: s.total }, (_, i) => `<span class="pip ${i < s.left ? "free" : ""}"></span>`).join("")}</div>` : "";
        const placed = s.placed.map(([who, where]) => `<li>${sigil(who, 20)}${where}</li>`).join("");
        return `<article class="vellum stock-item"><div class="head">${token(s.token)}<div><h3>${s.name}</h3><span class="cost">${s.cost} Gold each</span></div></div>
          <div class="left">${s.left} <small>of ${s.total} left</small></div>${pips}${placed ? `<ul class="placed">${placed}</ul>` : ""}</article>`;
      })
      .join("");
    const units = M.mercUnits.map((u) => `<tr><td>${u.name}</td><td class="num">${u.left} of ${u.total}</td><td>${u.cost}${/\d/.test(u.cost) ? " Gold" : ""}</td></tr>`).join("");
    const other = M.otherStock.map((o) => `<tr><td>${o.name}</td><td class="num">${o.left} of ${o.total}</td></tr>`).join("");
    const loans = M.loans.map((l) => `<tr><td>${sigil(l.owner, 22, "sigil")} ${F[l.owner].name}</td><td>${l.type} loan</td><td>${l.effect}</td></tr>`).join("");
    $("#view-market").innerHTML = `
      <div class="stock">${items}</div>
      <div class="tables">
        <section class="panel"><h2>Mercenary units</h2><table class="simple"><tr><th>Unit</th><th>Left</th><th>Cost</th></tr>${units}</table></section>
        <section class="panel"><h2>Other limited items</h2><table class="simple"><tr><th>Item</th><th>Left</th></tr>${other}</table>
          <h2 style="margin-top:18px">Loans taken</h2><table class="simple"><tr><th>House</th><th>Loan</th><th>Effect</th></tr>${loans}</table></section>
      </div>`;
  }

  /* ---------- log */
  function renderLog() {
    $("#view-log").innerHTML = `<table class="log">${M.log
      .slice()
      .reverse()
      .map(([r, p, t]) => `<tr><td class="num">R${r}</td><td>${p}</td><td>${t}</td></tr>`)
      .join("")}</table>`;
  }

  /* ---------- seats */
  function renderSeats() {
    const needed = new Set(M.checklist.waiting.filter((w) => w.state === "open").flatMap((w) => w.who));
    const councilOf = Object.fromEntries(M.council.map((c) => [c.holder, c.role]));
    $("#seats").innerHTML = M.factions
      .map((f) => {
        const loans = M.loans.filter((l) => l.owner === f.id).map((l) => `<span class="badge ${l.type === "Red" ? "red" : "gold"}" title="${l.type} loan: ${l.effect}">${l.type} loan</span>`).join("");
        const hostages = M.hostages.filter((h) => h.holder === f.id).length;
        const ring = M.ringsUsed.includes(f.id) ? "" : `<span class="badge ring" title="Can still propose a marriage">Ring</span>`;
        const SHORT = { "Hand of the King": "Hand", "Lord Commander of the Kingsguard": "Kingsguard", "Master of Coin": "Coin", "Master of Laws": "Laws", "Master of Whispers": "Whispers", "Master of Ships": "Ships", "Grand Maester": "Maester" };
        const role = councilOf[f.id] ? `<span class="badge role" title="${councilOf[f.id]}">${SHORT[councilOf[f.id]]}</span>` : "";
        return `<button class="seat ${needed.has(f.id) ? "needed" : ""}" type="button" data-house="${f.id}" style="--house:${f.color}">
          ${needed.has(f.id) ? '<span class="needed-tag">Your move</span>' : ""}
          ${sigil(f.id, 46)}
          <span class="name">${f.name}</span>
          <span class="badges">${role}${ring}${loans}${hostages ? `<span class="badge" title="Hostages held">${hostages} hostage</span>` : ""}</span>
          <span class="stats">
            <span class="stat"><span class="num">${f.power}</span><small>Power</small></span>
            <span class="stat"><span class="num">${f.gold}</span><small>Gold</small></span>
            <span class="stat"><span class="num">${f.supplyTok}</span><small>Supply</small></span>
            <span class="stat"><span class="num">${f.castles}</span><small>Castles</small></span>
            <span class="stat"><span class="num">${f.vp}</span><small>VP</small></span>
            <span class="stat"><span class="num">${f.objectives}</span><small>Obj.</small></span>
          </span></button>`;
      })
      .join("");
  }

  /* ---------- drawer (edit a house) */
  const FIELDS = [
    ["power", "Power tokens", 0, 20],
    ["gold", "Gold coins", 0, 99],
    ["supplyTok", "Supply tokens", 0, 3],
    ["castles", "Castles and strongholds", 0, 20],
    ["vp", "Victory points", 0, 20],
    ["objectives", "Objectives achieved", 0, 20]
  ];
  function openDrawer(id) {
    const f = F[id];
    const d = $("#drawer");
    d.innerHTML = `<header>${sigil(id, 64)}<h2>${f.name}</h2></header>
      ${FIELDS.map(([k, label]) => `<div class="field"><span>${label}</span><span class="stepper"><button type="button" data-k="${k}" data-d="-1" aria-label="Less ${label}">−</button><span class="num" id="v-${k}">${f[k]}</span><button type="button" data-k="${k}" data-d="1" aria-label="More ${label}">+</button></span></div>`).join("")}
      <p class="muted" style="font-size:14px;margin-top:14px">Limits: at most 20 Power tokens per house and 3 Supply tokens.</p>
      <button class="btn dark close" type="button" id="drawer-close">Close</button>`;
    d.hidden = false;
    d.dataset.house = id;
    $("#drawer-close").focus();
  }
  document.addEventListener("click", (e) => {
    const step = e.target.closest("[data-step]");
    if (step) {
      M.checklist.current = Number(step.dataset.step);
      renderTable();
      return;
    }
    const tab = e.target.closest("[data-view]");
    if (tab) {
      document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-selected", b === tab ? "true" : "false"));
      document.querySelectorAll(".view").forEach((v) => (v.hidden = v.id !== "view-" + tab.dataset.view));
      return;
    }
    const seat = e.target.closest("[data-house]");
    if (seat) return openDrawer(seat.dataset.house);
    const stp = e.target.closest("[data-k]");
    if (stp) {
      const f = F[$("#drawer").dataset.house];
      const [, , min, max] = FIELDS.find((x) => x[0] === stp.dataset.k);
      f[stp.dataset.k] = Math.max(min, Math.min(max, f[stp.dataset.k] + Number(stp.dataset.d)));
      $("#v-" + stp.dataset.k).textContent = f[stp.dataset.k];
      renderSeats();
      return;
    }
    if (e.target.id === "drawer-close") return ($("#drawer").hidden = true);
    if (e.target.id === "step-done") {
      const C = M.checklist;
      C.steps[C.current].done = true;
      C.current = Math.min(C.current + 1, C.steps.length - 1);
      renderTable();
      return;
    }
    const z = e.target.closest("[data-zoom]");
    if (z) {
      const lb = $("#lightbox");
      lb.querySelector("img").src = z.dataset.zoom;
      lb.querySelector("img").alt = z.alt;
      lb.hidden = false;
      return;
    }
    if (e.target.closest("#lightbox")) return ($("#lightbox").hidden = true);
    const peek = e.target.closest("[data-peek]");
    if (peek) return openCurtain(peek.dataset.peek);
    if (e.target.id === "curtain-reveal") return revealCurtain();
    if (e.target.id === "curtain-close") return ($("#curtain").hidden = true);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") ["#lightbox", "#drawer", "#curtain"].forEach((s) => ($(s).hidden = true));
  });

  /* ---------- eyes-only curtain (Grand Maester peek) */
  function openCurtain(who) {
    const c = $("#curtain");
    c.innerHTML = `<div class="curtain-box">${sigil(who, 120)}
      <h2>Eyes only: ${F[who].name}</h2>
      <p>Grand Maester. Everyone else, please look away from the screen. ${F[who].name} reveals the top cards of decks II and III and hides them again.</p>
      <button class="btn primary" type="button" id="curtain-reveal">Reveal the cards</button></div>`;
    c.hidden = false;
    $("#curtain-reveal").focus();
  }
  function revealCurtain() {
    const P = M.westeros.peekCards;
    const box = $("#curtain .curtain-box");
    box.querySelector("p").textContent = "Only you can see this. Hide the cards before anyone looks back.";
    box.querySelector("#curtain-reveal").outerHTML =
      `<div class="curtain-cards">${Object.values(P)
        .map((c) => {
          const card = westerosCard(c.deck, c.name, c.value);
          return `<figure><img src="${card.zoom}" alt="${card.name}"><figcaption>Top of deck ${ROMAN[c.deck]}</figcaption></figure>`;
        })
        .join("")}</div><button class="btn primary" type="button" id="curtain-close">Hide and mark as used</button>`;
    $("#curtain-close").focus();
    const ab = M.westeros.abilities.find((a) => a.state === "ready");
    if (ab) { ab.state = "used"; ab.detail = "Used this round"; }
    renderWesteros();
  }

  renderMasthead();
  renderTable();
  renderRelations();
  renderWesteros();
  renderMarket();
  renderLog();
  renderSeats();

  /* #relations, #westeros, #market, #log open that view; #peek opens the curtain. */
  const hash = location.hash.slice(1);
  const tab = hash && document.querySelector(`[data-view="${hash}"]`);
  if (tab) tab.click();
  if (hash === "peek") openCurtain("arryn");
  if (hash === "peek-open") { openCurtain("arryn"); revealCurtain(); }
  if (hash === "drawer") openDrawer("martell");
})();
