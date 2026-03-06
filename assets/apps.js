// =====================
// CONFIG
// =====================
const OWNER = "bobbyengleiii-lgtm";
const REPO  = "AxonFleetKnowledgePortal";
const ISSUE_TEMPLATE = "kb-ticket.yml";
const INDEX_URL = "./assets/search-index.json";

const VIEW_KEY = "kb_views_v1";         // { [idOrUrl]: {count, lastViewedISO} }
const RECENT_KEY = "kb_recent_v1";      // [{title,url,updated,product,category,status}]
const RECENT_MAX = 6;

// Categories shown as tiles on Home (match your mock)
const HOME_TILES = [
  { label: "Golden Standard Installs", icon: "⚙️", filter: { category: "Install Standards" } },
  { label: "Troubleshooting",          icon: "🛠️", filter: { category: "Troubleshooting" } },
  { label: "Wiring & Diagrams",        icon: "🧾", filter: { category: "Wiring" } },
  { label: "Vehicle Guides",           icon: "🚗", filter: { category: "Vehicle Guides" } },
  { label: "Fleet3 Camera/Sensor",     icon: "📷", filter: { category: "Fleet3 Camera/Sensor" } },
];

// =====================
// Helpers
// =====================
function qs(name){ return new URLSearchParams(location.search).get(name) || ""; }
function norm(s){ return (s || "").toString().toLowerCase(); }
function uniq(arr){ return [...new Set(arr)].filter(Boolean); }
function fmtDate(iso){
  if (!iso) return "";
  // Accept YYYY-MM-DD or ISO
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month:"short", day:"numeric" });
}

function getViews(){
  try { return JSON.parse(localStorage.getItem(VIEW_KEY) || "{}"); } catch { return {}; }
}
function setViews(obj){ localStorage.setItem(VIEW_KEY, JSON.stringify(obj)); }

function bumpView(doc){
  const key = doc.article_id || doc.path || doc.url;
  const views = getViews();
  const curr = views[key] || { count: 0, lastViewedISO: "" };
  curr.count += 1;
  curr.lastViewedISO = new Date().toISOString();
  views[key] = curr;
  setViews(views);
}

function getRecent(){
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); } catch { return []; }
}
function setRecent(list){ localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, RECENT_MAX))); }
function addRecent(doc){
  const key = doc.article_id || doc.path || doc.url;
  const existing = getRecent().filter(x => (x.key !== key));
  existing.unshift({
    key,
    title: doc.title,
    url: doc.url,
    updated: doc.updated || doc.last_verified || "",
    product: doc.product || "",
    category: doc.category || "",
    status: doc.status || ""
  });
  setRecent(existing);
}

function score(doc, q){
  const nq = norm(q);
  if (!nq) return 0;
  const title = norm(doc.title);
  const tags  = norm((doc.tags || []).join(" "));
  const meta  = norm([doc.product, doc.category, doc.owner, doc.status].join(" "));
  const body  = norm(doc.content);

  let s = 0;
  if (title.includes(nq)) s += 12;
  if (tags.includes(nq))  s += 7;
  if (meta.includes(nq))  s += 5;

  if (body.includes(nq)){
    const hits = body.split(nq).length - 1;
    s += Math.min(8, 2 + hits);
  }
  return s;
}

async function loadIndex(){
  const res = await fetch(INDEX_URL, { cache: "no-store" });
  if (!res.ok) throw new Error("search-index.json not found. Run workflow / ensure it exists in /assets.");

  const text = await res.text();
  if (!text.trim()) throw new Error("search-index.json is empty.");

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error("Invalid search-index.json:", text);
    throw new Error("search-index.json is invalid JSON.");
  }
}
// Extract key sections from markdown-ish content stored in index
function extractSection(content, heading){
  // heading like "Client Issue Description"
  const re = new RegExp(`\\n##\\s+${heading}\\s*\\n([\\s\\S]*?)(\\n##\\s+|$)`, "i");
  const m = (content || "").match(re);
  return m ? m[1].trim() : "";
}
function extractH1(content){
  const m = (content || "").match(/^#\s+(.+)$/m);
  return m ? m[1].trim() : "";
}
function bulletsFrom(text){
  // grab "- item" lines; fallback split sentences
  const lines = (text || "").split("\n").map(x => x.trim());
  const bullets = lines.filter(x => x.startsWith("- ")).map(x => x.slice(2).trim());
  return bullets.length ? bullets : lines.filter(Boolean).slice(0,8);
}

// =====================
// Routing
// =====================
(async function init(){
  const page = document.body.getAttribute("data-page");
  const index = await loadIndex();

  if (page === "home") return initHome(index);
  if (page === "list") return initList(index);
  if (page === "article") return initArticle(index);
})().catch(err => {
  const el = document.getElementById("statusText");
  if (el) el.textContent = `Error: ${err.message}`;
});

// =====================
// HOME
// =====================
function initHome(index){
  // Wire submit
  const submit = document.getElementById("submitBtn");
  if (submit){
    submit.addEventListener("click", () => {
      window.open(`https://github.com/${OWNER}/${REPO}/issues/new/choose`, "_blank", "noopener");
    });
  }

  // Search bar -> list page with q=
  const q = document.getElementById("homeSearch");
  const go = document.getElementById("homeGo");
  const run = () => location.href = `./kb-articles.html?q=${encodeURIComponent(q.value.trim())}`;
  q?.addEventListener("keydown", e => { if (e.key === "Enter") run(); });
  go?.addEventListener("click", run);

  // Tiles
  const tiles = document.getElementById("tileRow");
  tiles.innerHTML = HOME_TILES.map(t => `
    <div class="tile" data-cat="${t.filter.category}">
      <div class="t-ico">${t.icon}</div>
      <div class="t-text">${t.label}</div>
    </div>
  `).join("");
  tiles.querySelectorAll(".tile").forEach(tile => {
    tile.addEventListener("click", () => {
      const cat = tile.getAttribute("data-cat");
      location.href = `./kb-articles.html?category=${encodeURIComponent(cat)}`;
    });
  });

  // Recently Updated (by updated/last_verified)
  const updated = index
    .slice()
    .sort((a,b) => (b.updated || b.last_verified || "").localeCompare(a.updated || a.last_verified || ""))
    .slice(0,3);

  // Most viewed this week (local views, lastViewed within 7 days)
  const views = getViews();
  const cutoff = Date.now() - 7*24*60*60*1000;
  const byViews = index
    .map(d => {
      const key = d.article_id || d.path || d.url;
      const v = views[key] || {count:0, lastViewedISO:""};
      const last = v.lastViewedISO ? new Date(v.lastViewedISO).getTime() : 0;
      const eligible = last >= cutoff;
      return { ...d, _views: eligible ? v.count : 0 };
    })
    .sort((a,b) => (b._views - a._views))
    .filter(d => d._views > 0)
    .slice(0,3);

  // Critical Alerts (status === "Alert" or category contains "Known Issues" or tags contains "alert")
  const alerts = index
    .filter(d =>
      norm(d.status) === "alert" ||
      norm(d.category).includes("known") ||
      (d.tags || []).some(t => norm(t).includes("alert"))
    )
    .sort((a,b) => (b.updated || b.last_verified || "").localeCompare(a.updated || a.last_verified || ""))
    .slice(0,3);

  renderHomeList("recentlyUpdated", updated, false);
  renderHomeList("mostViewed", byViews.length ? byViews : updated, false);
  renderHomeList("criticalAlerts", alerts.length ? alerts : [], true);
}

function renderHomeList(targetId, items, isAlert){
  const ul = document.getElementById(targetId);
  if (!ul) return;

  if (!items.length){
    ul.innerHTML = `<li><span class="muted">No items yet.</span></li>`;
    return;
  }

  ul.innerHTML = items.map(d => `
    <li>
      ${isAlert ? `<span class="alert-dot">!</span>` : `<span class="bullet"></span>`}
      <div>
        <a href="./kb-article.html?id=${encodeURIComponent(d.article_id || d.path || d.url)}">${d.title}</a>
        <div class="muted">${d.product || ""}${d.product && d.category ? " • " : ""}${d.category || ""}</div>
      </div>
    </li>
  `).join("");
}

// =====================
// LIST (KB Articles)
// =====================
function initList(index){
  const submit = document.getElementById("submitBtn");
  submit?.addEventListener("click", () => {
    window.open(`https://github.com/${OWNER}/${REPO}/issues/new/choose`, "_blank", "noopener");
  });

  const q = document.getElementById("q");
  const category = document.getElementById("category");
  const product = document.getElementById("product");
  const status = document.getElementById("status");
  const tag = document.getElementById("tag");
  const clear = document.getElementById("clearBtn");
  const tbody = document.getElementById("tbody");
  const statusText = document.getElementById("statusText");

  // Populate filters
  const categories = uniq(index.map(d => (d.category||"").trim())).sort();
  const products = uniq(index.map(d => (d.product||"").trim())).sort();
  const statuses = uniq(index.map(d => (d.status||"").trim())).sort();
  const tags = uniq(index.flatMap(d => d.tags || [])).map(t => t.trim()).sort();

  for (const c of categories) category.append(new Option(c, c));
  for (const p of products)  product.append(new Option(p, p));
  for (const s of statuses)  status.append(new Option(s, s));
  for (const t of tags)      tag.append(new Option(`Tag: ${t}`, t));

  // Apply query params
  q.value = qs("q");
  if (qs("category")) category.value = qs("category");
  if (qs("product")) product.value = qs("product");
  if (qs("status")) status.value = qs("status");
  if (qs("tag")) tag.value = qs("tag");

  function run(){
    const query = q.value.trim();
    const c = category.value.trim();
    const p = product.value.trim();
    const s = status.value.trim();
    const t = tag.value.trim();

    let pool = index.slice();
    if (c) pool = pool.filter(d => (d.category||"").trim() === c);
    if (p) pool = pool.filter(d => (d.product||"").trim() === p);
    if (s) pool = pool.filter(d => (d.status||"").trim() === s);
    if (t) pool = pool.filter(d => (d.tags||[]).some(x => x === t));

    if (query){
      pool = pool
        .map(d => ({...d, _score: score(d, query)}))
        .filter(d => d._score > 0)
        .sort((a,b) => b._score - a._score);
    } else {
      pool = pool.sort((a,b) => (b.updated || b.last_verified || "").localeCompare(a.updated || a.last_verified || ""));
    }

    statusText.textContent = `${pool.length} article(s)`;
    tbody.innerHTML = pool.slice(0, 200).map(d => {
      const st = (d.status || "").trim();
      const pill =
        norm(st) === "published" ? "status-pill status-published" :
        norm(st) === "draft" ? "status-pill status-draft" :
        norm(st) === "alert" ? "status-pill status-alert" :
        "status-pill";

      return `
        <tr>
          <td>
            <a class="rowlink" href="./kb-article.html?id=${encodeURIComponent(d.article_id || d.path || d.url)}">${d.title}</a>
          </td>
          <td>${d.category || ""}</td>
          <td>${d.product || ""}</td>
          <td>${fmtDate(d.updated || d.last_verified || "")}</td>
          <td>${d.owner || ""}</td>
          <td><span class="${pill}">${st || "—"}</span></td>
          <td>…</td>
        </tr>
      `;
    }).join("");
  }

  q.addEventListener("input", run);
  category.addEventListener("change", run);
  product.addEventListener("change", run);
  status.addEventListener("change", run);
  tag.addEventListener("change", run);

  clear.addEventListener("click", () => {
    q.value = "";
    category.value = "";
    product.value = "";
    status.value = "";
    tag.value = "";
    run();
  });

  run();
}

// =====================
// ARTICLE
// =====================
function initArticle(index){
  const submit = document.getElementById("submitBtn");
  submit?.addEventListener("click", () => {
    window.open(`https://github.com/${OWNER}/${REPO}/issues/new/choose`, "_blank", "noopener");
  });

  const id = qs("id");
  const doc = index.find(d => (d.article_id || d.path || d.url) === id)
           || index.find(d => d.url === id)
           || null;

  const titleEl = document.getElementById("title");
  const metaEl = document.getElementById("meta");
  const summaryEl = document.getElementById("summary");
  const appliesEl = document.getElementById("applies");
  const stepsEl = document.getElementById("steps");
  const attachmentsEl = document.getElementById("attachments");
  const sourceEl = document.getElementById("sourceLink");

  if (!doc){
    titleEl.textContent = "Article not found";
    metaEl.textContent = "Check the id parameter and ensure the index contains this article.";
    return;
  }

  bumpView(doc);
  addRecent(doc);

  titleEl.textContent = doc.title || extractH1(doc.content) || "KB Article";
  metaEl.textContent = [
    doc.product ? `Product: ${doc.product}` : "",
    doc.category ? `Category: ${doc.category}` : "",
    doc.updated || doc.last_verified ? `Updated: ${fmtDate(doc.updated || doc.last_verified)}` : "",
    doc.owner ? `Owner: ${doc.owner}` : "",
    doc.status ? `Status: ${doc.status}` : ""
  ].filter(Boolean).join("  •  ");

  // Try to pull a one-line summary from front matter (doc.summary) or first paragraph
  const firstPara = (doc.content || "").split("\n").find(x => x.trim() && !x.trim().startsWith("#")) || "";
  summaryEl.textContent = doc.summary || firstPara.trim().slice(0, 180) || "—";

  // Applies To: from optional front matter field OR infer from tags/product
  const applies = doc.applies_to && Array.isArray(doc.applies_to) ? doc.applies_to
    : [
        doc.product || "Fleet",
        ...(doc.tags || []).slice(0,3)
      ].filter(Boolean);

  appliesEl.innerHTML = `<ul>${applies.map(x => `<li>${x}</li>`).join("")}</ul>`;

  // Steps: if your markdown includes "## Steps" section, parse bullets/numbered lines
  const stepsText = extractSection(doc.content || "", "Steps") || extractSection(doc.content || "", "Resolution Performed");
  const steps = bulletsFrom(stepsText).slice(0, 10);

  stepsEl.innerHTML = steps.length
    ? `<ol>${steps.map(s => `<li>${s.replace(/^\d+\.\s*/,"")}</li>`).join("")}</ol>`
    : `<p>Steps not found in index content. Add a <strong>## Steps</strong> section to the markdown.</p>`;

  // Attachments: optional front matter in index as attachments: [{name,url}]
  const atts = Array.isArray(doc.attachments) ? doc.attachments : [];
  attachmentsEl.innerHTML = atts.length
    ? `<div class="attach">${atts.map(a => `<div>☑ <a href="${a.url}" target="_blank" rel="noopener">${a.name}</a></div>`).join("")}</div>`
    : `<div class="meta">No attachments listed.</div>`;

  sourceEl.href = doc.url;
  sourceEl.textContent = "Open source (GitHub)";

  // Helpful buttons
  document.getElementById("yesBtn").addEventListener("click", () => alert("Thanks — feedback recorded locally."));
  document.getElementById("noBtn").addEventListener("click", () => alert("Thanks — feedback recorded locally."));
  document.getElementById("requestBtn").addEventListener("click", () => {
    // Opens a new issue (you can swap to a dedicated “request-update” template if you make one)
    const t = encodeURIComponent(`[KB Update Request] ${doc.title}`);
    window.open(`https://github.com/${OWNER}/${REPO}/issues/new?title=${t}&labels=kb,update-request`, "_blank", "noopener");
  });
}
