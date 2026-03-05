async function loadIndex() {
  const res = await fetch("./assets/search-index.json", { cache: "no-store" });
  if (!res.ok) throw new Error("search-index.json not found (did the workflow run?)");
  return res.json();
}

function normalize(s) {
  return (s || "").toLowerCase();
}

function scoreDoc(doc, q) {
  // Simple scoring: title hits > tags > product/category > body
  const nq = normalize(q);
  const title = normalize(doc.title);
  const tags  = normalize((doc.tags || []).join(" "));
  const meta  = normalize([doc.product, doc.category].join(" "));
  const body  = normalize(doc.content);

  let score = 0;
  if (title.includes(nq)) score += 10;
  if (tags.includes(nq))  score += 6;
  if (meta.includes(nq))  score += 4;
  if (body.includes(nq))  score += 2;
  return score;
}

function render(results) {
  const out = document.getElementById("results");
  out.innerHTML = results.map(r => `
    <div class="result">
      <div><a href="${r.url}"><strong>${r.title}</strong></a></div>
      <div class="meta">
        ${r.product || ""}${r.product && r.category ? " • " : ""}${r.category || ""}
        ${r.tags?.length ? " • " + r.tags.join(", ") : ""}
      </div>
    </div>
  `).join("");
}

(async function init() {
  const data = await loadIndex();
  const q = document.getElementById("q");
  const count = document.getElementById("count");

  function run() {
    const query = q.value.trim();
    if (!query) {
      count.textContent = `Showing newest articles`;
      const newest = [...data].sort((a,b) => (b.last_verified||"").localeCompare(a.last_verified||"")).slice(0, 25);
      render(newest);
      return;
    }
    const scored = data
      .map(d => ({...d, _score: scoreDoc(d, query)}))
      .filter(d => d._score > 0)
      .sort((a,b) => b._score - a._score)
      .slice(0, 50);

    count.textContent = `${scored.length} result(s)`;
    render(scored);
  }

  q.addEventListener("input", run);
  run();
})();
