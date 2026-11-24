// Zoekhulp Précon — Richting A: Spotlight
// Vanilla JS, hash-routing, geen build-stap nodig.

const app = document.getElementById("app");
const topbar = document.getElementById("topbar") || document.querySelector(".topbar");
const topbarSearch = document.getElementById("topbarSearch");
const topbarInput = document.getElementById("topbarInput");

const byId = (id) => QA.find((q) => q.id === id);
const catLabel = (slug) => (CATEGORIES.find((c) => c.slug === slug) || {}).label || slug;
const catByCategory = (slug) => QA.filter((q) => q.category === slug);

function normalize(s) {
  return (s || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "");
}

function highlight(text, query) {
  if (!query) return escapeHtml(text);
  const nText = normalize(text);
  const nQuery = normalize(query);
  const idx = nText.indexOf(nQuery);
  if (idx === -1) return escapeHtml(text);
  return (
    escapeHtml(text.slice(0, idx)) +
    "<mark>" + escapeHtml(text.slice(idx, idx + query.length)) + "</mark>" +
    escapeHtml(text.slice(idx + query.length))
  );
}

function escapeHtml(s) {
  return (s || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// Zoekt vragen op basis van tekst, keywords en categorie. Retourneert gesorteerde matches.
function search(query) {
  const q = normalize(query.trim());
  if (!q) return { direct: [], categories: [] };
  const terms = q.split(/\s+/).filter(Boolean);

  const scored = QA.map((item) => {
    const hay = normalize(item.q);
    const kw = (item.keywords || []).map(normalize);
    let score = 0;
    if (hay.includes(q)) score += 50;
    terms.forEach((t) => {
      if (hay.includes(t)) score += 10;
      if (kw.some((k) => k.includes(t))) score += 8;
    });
    return { item, score };
  }).filter((r) => r.score > 0);

  scored.sort((a, b) => b.score - a.score);

  const matchedCatSlugs = new Set();
  scored.forEach((r) => matchedCatSlugs.add(r.item.category));
  const categories = CATEGORIES.filter((c) => {
    const nLabel = normalize(c.label);
    return terms.some((t) => nLabel.includes(t)) && !scored.some((r) => r.item.category === c.slug && r.score >= 50);
  });

  return { direct: scored.slice(0, 6).map((r) => r.item), categories };
}

// ===== Rendering =====

function renderHome() {
  app.innerHTML = `
    <div class="home wrap">
      <div class="home-logo">Précon</div>
      <h1>Waar ben je naar op zoek?</h1>
      <div class="search-box-wrap">
        <div class="search-box">
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="6.5" stroke="#003855" stroke-width="2"/><line x1="14" y1="14" x2="20" y2="20" stroke="#003855" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="homeInput" type="text" autocomplete="off" placeholder='Typ je vraag… bv. "vrije dag verplaatsen"' />
        </div>
        <div id="homeSuggest"></div>
      </div>
      <div class="popular">
        <span class="popular-label">Populair:</span>
        ${POPULAR_IDS.map((id) => {
          const item = byId(id);
          return item ? `<span class="chip-outline" data-goto="${item.id}">${escapeHtml(item.q)}</span>` : "";
        }).join("")}
      </div>
    </div>

    <div class="section-title wrap">Of blader door onderwerpen</div>
    <div class="wrap">
      <div class="topic-grid">
        ${CATEGORIES.map((c) => `
          <div class="topic-card">
            <h4>${escapeHtml(c.label)}</h4>
            <ul>
              ${catByCategory(c.slug).slice(0, 4).map((item) => `<li data-goto="${item.id}">${escapeHtml(item.q)} &rarr;</li>`).join("")}
            </ul>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  const input = document.getElementById("homeInput");
  const suggestWrap = document.getElementById("homeSuggest");
  input.focus();

  const doSearch = () => {
    const val = input.value;
    if (!val.trim()) {
      suggestWrap.innerHTML = "";
      return;
    }
    const { direct, categories } = search(val);
    suggestWrap.innerHTML = renderSuggestPanel(direct, categories, val);
    bindGoto(suggestWrap);
  };

  input.addEventListener("input", doSearch);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const { direct } = search(input.value);
      if (direct.length) go(direct[0].id);
      else goEmpty(input.value);
    }
    if (e.key === "Escape") {
      input.value = "";
      suggestWrap.innerHTML = "";
    }
  });

  bindGoto(app);
}

function renderSuggestPanel(direct, categories, query) {
  if (!direct.length && !categories.length) {
    return `<div class="suggest-panel"><div class="suggest-empty">Geen directe match voor "${escapeHtml(query)}". Druk op Enter om alle onderwerpen te zien.</div></div>`;
  }
  let html = `<div class="suggest-panel">`;
  if (direct.length) {
    html += `<div class="suggest-group-label">Veelgestelde vragen</div>`;
    direct.forEach((item) => {
      html += `
        <div class="suggest-item" data-goto="${item.id}">
          <svg width="18" height="18" viewBox="0 0 22 22" fill="none" style="flex-shrink:0;"><circle cx="9" cy="9" r="6.5" stroke="#003855" stroke-width="2"/><line x1="14" y1="14" x2="20" y2="20" stroke="#003855" stroke-width="2" stroke-linecap="round"/></svg>
          <span class="q-text">${highlight(item.q, query)} <span class="q-cat">(${escapeHtml(catLabel(item.category))})</span></span>
        </div>`;
    });
  }
  if (categories.length) {
    html += `<div class="suggest-divider"></div><div class="suggest-group-label">Categorie</div>`;
    categories.forEach((c) => {
      html += `<div class="suggest-category" data-goto-cat="${c.slug}">Alle vragen over <b>${escapeHtml(c.label)}</b> &rarr;</div>`;
    });
  }
  html += `</div>`;
  return html;
}

function renderAnswer(id) {
  const item = byId(id);
  if (!item) return renderEmpty("");

  const contact = item.contact ? CONTACTS[item.contact] : null;
  const related = (item.related || []).map(byId).filter(Boolean);

  app.innerHTML = `
    <div class="wrap">
      <div class="answer-header">
        <span class="back-link" data-goto-home="1">&larr;</span>
        <div class="answer-searchbar">
          <svg width="17" height="17" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="6.5" stroke="#003855" stroke-width="2"/><line x1="14" y1="14" x2="20" y2="20" stroke="#003855" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="answerInput" type="text" autocomplete="off" placeholder="Zoek een andere vraag…" />
        </div>
      </div>

      <div class="card answer-card">
        <div class="breadcrumb"><span data-goto-home="1">Zoekhulp</span> &nbsp;/&nbsp; <span data-goto-cat="${item.category}">${escapeHtml(catLabel(item.category))}</span> &nbsp;/&nbsp; ${escapeHtml(item.q)}</div>
        <h2>${escapeHtml(item.q)}</h2>
        <p class="answer-intro">${escapeHtml(item.intro)}</p>

        <div class="answer-grid">
          <div class="answer-main">
            ${item.steps && item.steps.length ? `
              <div class="steps-card">
                <div class="steps-title">In het kort &mdash; stappenplan</div>
                <div class="step-list">
                  ${item.steps.map((s, i) => `
                    <div class="step">
                      <span class="step-num">${i + 1}</span>
                      <div class="step-text">${escapeHtml(s)}</div>
                    </div>
                  `).join("")}
                </div>
              </div>
            ` : ""}

            ${item.selfService ? `
              <div class="self-service">
                <div class="self-service-title">Dit doe je zelf &mdash; waar?</div>
                <p>${item.selfService.note ? escapeHtml(item.selfService.note) : "Dit regel je zelf, geen aanvraag nodig via een collega."}</p>
                <span class="system-badge">${escapeHtml(item.selfService.label)}</span>
              </div>
            ` : ""}

            ${item.details && item.details.length ? item.details.map((d) => `
              <div class="details-card">${escapeHtml(d)}</div>
            `).join("") : ""}
          </div>

          <div class="answer-side">
            ${contact ? `
              <div class="contact-card">
                <div class="ct-title">Kom je er niet uit?</div>
                <div class="ct-sub">Vraag het deze mensen:</div>
                <div class="contact-person">
                  <div class="avatar">${escapeHtml((contact.name || "?").charAt(0))}</div>
                  <div>
                    <div class="contact-name">${escapeHtml(contact.name)}</div>
                    <div class="contact-role">${escapeHtml(contact.role)}</div>
                  </div>
                </div>
                <a class="contact-email" href="mailto:${escapeHtml(contact.email)}">&#9993; ${escapeHtml(contact.email)}</a>
              </div>
            ` : `
              <div class="contact-card">
                <div class="ct-title">Kom je er niet uit?</div>
                <div class="ct-sub">Vraag het een collega of stuur een mail naar</div>
                <a class="contact-email" href="mailto:info@precongroup.com">&#9993; info@precongroup.com</a>
              </div>
            `}
          </div>
        </div>

        ${related.length ? `
          <div class="related-block">
            <div class="related-title">Gerelateerde vragen</div>
            <div class="related-list">
              ${related.map((r) => `<span class="related-chip" data-goto="${r.id}">${escapeHtml(r.q)} &rarr;</span>`).join("")}
            </div>
          </div>
        ` : ""}
      </div>
    </div>
  `;

  const input = document.getElementById("answerInput");
  wireInlineSearch(input, app);
  bindGoto(app);
}

function renderEmpty(query) {
  app.innerHTML = `
    <div class="wrap">
      <div class="answer-header" style="margin-top:24px;">
        <span class="back-link" data-goto-home="1">&larr;</span>
      </div>
      <div class="card empty-card">
        <div class="empty-searchbar">
          <svg width="20" height="20" viewBox="0 0 22 22" fill="none"><circle cx="9" cy="9" r="6.5" stroke="#003855" stroke-width="2"/><line x1="14" y1="14" x2="20" y2="20" stroke="#003855" stroke-width="2" stroke-linecap="round"/></svg>
          <input id="emptyInput" type="text" autocomplete="off" value="${escapeHtml(query)}" />
          <span style="color:#fa6401; font-size:20px;">&times;</span>
        </div>
        <div class="empty-headline">
          <strong>Geen direct antwoord gevonden.</strong>
          <span>Kies hieronder een onderwerp, of stel je vraag aan een collega.</span>
        </div>
        <div class="topic-grid">
          ${CATEGORIES.map((c) => `
            <div class="topic-card">
              <h4>${escapeHtml(c.label)}</h4>
              <ul>
                ${catByCategory(c.slug).slice(0, 5).map((item) => `<li data-goto="${item.id}">${escapeHtml(item.q)} &rarr;</li>`).join("")}
              </ul>
            </div>
          `).join("")}
          <div class="ask-colleague-card">
            <strong>Staat je vraag er niet bij?</strong>
            <a href="mailto:info@precongroup.com">Vraag aan een collega &rarr;</a>
            <small>of meld dat dit antwoord ontbreekt</small>
          </div>
        </div>
      </div>
    </div>
  `;

  const input = document.getElementById("emptyInput");
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const { direct } = search(input.value);
      if (direct.length) go(direct[0].id);
      else goEmpty(input.value);
    }
  });
  bindGoto(app);
}

function renderCategory(slug) {
  const items = catByCategory(slug);
  app.innerHTML = `
    <div class="wrap">
      <div class="answer-header" style="margin-top:24px;">
        <span class="back-link" data-goto-home="1">&larr;</span>
      </div>
      <div class="card empty-card">
        <div class="empty-headline">
          <strong>${escapeHtml(catLabel(slug))}</strong>
          <span>${items.length} vragen in deze categorie.</span>
        </div>
        <div class="topic-grid">
          <div class="topic-card" style="grid-column: 1 / -1;">
            <ul>
              ${items.map((item) => `<li data-goto="${item.id}">${escapeHtml(item.q)} &rarr;</li>`).join("")}
            </ul>
          </div>
        </div>
      </div>
    </div>
  `;
  bindGoto(app);
}

// ===== Wiring helpers =====

function wireInlineSearch(input, container) {
  let panelHost = null;
  const closeSuggest = () => { if (panelHost) { panelHost.remove(); panelHost = null; } };
  input.addEventListener("input", () => {
    closeSuggest();
    if (!input.value.trim()) return;
    const { direct, categories } = search(input.value);
    panelHost = document.createElement("div");
    panelHost.style.position = "relative";
    panelHost.innerHTML = renderSuggestPanel(direct, categories, input.value);
    input.closest(".answer-searchbar, .empty-searchbar").after(panelHost);
    bindGoto(panelHost);
  });
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const { direct } = search(input.value);
      if (direct.length) go(direct[0].id);
      else goEmpty(input.value);
    }
    if (e.key === "Escape") closeSuggest();
  });
  document.addEventListener("click", (e) => {
    if (panelHost && !panelHost.contains(e.target) && e.target !== input) closeSuggest();
  }, { once: true });
}

function bindGoto(root) {
  root.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => go(el.getAttribute("data-goto")));
  });
  root.querySelectorAll("[data-goto-cat]").forEach((el) => {
    el.addEventListener("click", () => goCategory(el.getAttribute("data-goto-cat")));
  });
  root.querySelectorAll("[data-goto-home]").forEach((el) => {
    el.addEventListener("click", () => goHome());
  });
}

function go(id) { location.hash = "#/vraag/" + encodeURIComponent(id); }
function goCategory(slug) { location.hash = "#/categorie/" + encodeURIComponent(slug); }
function goEmpty(query) { location.hash = "#/geen-resultaten/" + encodeURIComponent(query || ""); }
function goHome() { location.hash = "#/"; }

// ===== Router =====

function route() {
  const hash = location.hash.replace(/^#\/?/, "");
  const [kind, ...rest] = hash.split("/");
  window.scrollTo(0, 0);

  if (!kind) return renderHome();
  if (kind === "vraag") return renderAnswer(decodeURIComponent(rest.join("/")));
  if (kind === "categorie") return renderCategory(decodeURIComponent(rest.join("/")));
  if (kind === "geen-resultaten") return renderEmpty(decodeURIComponent(rest.join("/")));
  return renderHome();
}

window.addEventListener("hashchange", route);

// Sticky topbar search: shows once you've scrolled past the home spotlight.
function syncTopbar() {
  const onHome = !location.hash || location.hash === "#/" || location.hash === "#";
  topbarSearch.hidden = onHome;
  document.querySelector(".topbar").classList.toggle("scrolled", window.scrollY > 4);
}
window.addEventListener("hashchange", syncTopbar);
window.addEventListener("scroll", () => document.querySelector(".topbar").classList.toggle("scrolled", window.scrollY > 4));

topbarInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    const { direct } = search(topbarInput.value);
    if (direct.length) go(direct[0].id);
    else goEmpty(topbarInput.value);
  }
});
wireInlineSearchTopbar();

function wireInlineSearchTopbar() {
  let panelHost = null;
  const closeSuggest = () => { if (panelHost) { panelHost.remove(); panelHost = null; } };
  topbarInput.addEventListener("input", () => {
    closeSuggest();
    if (!topbarInput.value.trim()) return;
    const { direct, categories } = search(topbarInput.value);
    panelHost = document.createElement("div");
    panelHost.style.position = "relative";
    panelHost.innerHTML = renderSuggestPanel(direct, categories, topbarInput.value);
    topbarSearch.after(panelHost);
    bindGoto(panelHost);
  });
  document.addEventListener("click", (e) => {
    if (panelHost && !topbarSearch.contains(e.target) && !panelHost.contains(e.target)) closeSuggest();
  });
}

route();
syncTopbar();
