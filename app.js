const STORAGE_KEY = "stockup_items_v1";

const els = {
  list: document.getElementById("list"),
  search: document.getElementById("search"),
  filterVendor: document.getElementById("filterVendor"),
  btnShare: document.getElementById("btnShare"),
  btnReset: document.getElementById("btnReset"),
  btnAdd: document.getElementById("btnAdd"),
  btnExport: document.getElementById("btnExport"),
  importFile: document.getElementById("importFile"),

  dlg: document.getElementById("dlg"),
  dlgTitle: document.getElementById("dlgTitle"),
  fName: document.getElementById("fName"),
  fCategory: document.getElementById("fCategory"),
  fQty: document.getElementById("fQty"),
  fUnit: document.getElementById("fUnit"),
  fVendor: document.getElementById("fVendor"),
  fNotes: document.getElementById("fNotes"),
  itemForm: document.getElementById("itemForm")
};

function uid() { return Math.random().toString(36).slice(2, 10); }

function loadItems() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) return JSON.parse(raw);

  // Starter template — edit these to your real list
  const seed = [
    { id: uid(), name: "Mozzarella", category: "Cheese", qty: 2, unit: "kg", vendor: "NSK", notes: "", checked: false },
    { id: uid(), name: "Tomato sauce", category: "Sauce", qty: 6, unit: "cans", vendor: "Lotus", notes: "Pizza base", checked: false },
    { id: uid(), name: "Pepperoni", category: "Toppings", qty: 1, unit: "kg", vendor: "Supplier A", notes: "", checked: false },
    { id: uid(), name: "Pizza box 10-inch", category: "Packaging", qty: 50, unit: "pcs", vendor: "Shopee", notes: "", checked: false },
    { id: uid(), name: "Gas/Butane", category: "Ops", qty: 2, unit: "canisters", vendor: "Hardware", notes: "", checked: false }
  ];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  return seed;
}

function saveItems(items) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

let items = loadItems();
let editingId = null;

function vendorsFromItems(list) {
  const set = new Set(list.map(x => (x.vendor || "").trim()).filter(Boolean));
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function renderVendorFilter() {
  const vendors = vendorsFromItems(items);
  const current = els.filterVendor.value;
  els.filterVendor.innerHTML = `<option value="">All vendors</option>` + vendors.map(v => `<option>${escapeHtml(v)}</option>`).join("");
  if (vendors.includes(current)) els.filterVendor.value = current;
}

function escapeHtml(s) {
  return String(s).replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;");
}

function filteredItems() {
  const q = els.search.value.trim().toLowerCase();
  const v = (els.filterVendor.value || "").trim().toLowerCase();
  return items.filter(it => {
    const matchesQ = !q || (it.name + " " + it.category + " " + it.vendor).toLowerCase().includes(q);
    const matchesV = !v || (it.vendor || "").toLowerCase() === v;
    return matchesQ && matchesV;
  });
}

function render() {
  renderVendorFilter();
  const list = filteredItems();

  if (!list.length) {
    els.list.innerHTML = `<div class="card">No items found.</div>`;
    return;
  }

  els.list.innerHTML = list.map(it => `
    <div class="card">
      <div class="line">
        <label style="display:flex; gap:10px; align-items:center; flex:1;">
          <input type="checkbox" ${it.checked ? "checked" : ""} data-act="toggle" data-id="${it.id}" />
          <div>
            <div><b>${escapeHtml(it.name)}</b></div>
            <div class="meta">
              ${it.category ? `<span class="badge">${escapeHtml(it.category)}</span>` : ""}
              ${(it.qty || it.unit) ? `<span class="badge">${escapeHtml((it.qty ?? "") + " " + (it.unit ?? "")).trim()}</span>` : ""}
              ${it.vendor ? `<span class="badge">Buy: ${escapeHtml(it.vendor)}</span>` : ""}
              ${it.notes ? `<span class="badge">Note: ${escapeHtml(it.notes)}</span>` : ""}
            </div>
          </div>
        </label>

        <div class="smallBtns">
          <button data-act="edit" data-id="${it.id}">Edit</button>
          <button data-act="del" data-id="${it.id}">Del</button>
        </div>
      </div>
    </div>
  `).join("");
}

function openDialog(mode, it=null) {
  els.dlgTitle.textContent = mode === "edit" ? "Edit item" : "Add item";
  editingId = it?.id ?? null;

  els.fName.value = it?.name ?? "";
  els.fCategory.value = it?.category ?? "";
  els.fQty.value = it?.qty ?? "";
  els.fUnit.value = it?.unit ?? "";
  els.fVendor.value = it?.vendor ?? "";
  els.fNotes.value = it?.notes ?? "";

  els.dlg.showModal();
}

function upsertFromForm() {
  const name = els.fName.value.trim();
  if (!name) return;

  const payload = {
    id: editingId ?? uid(),
    name,
    category: els.fCategory.value.trim(),
    qty: els.fQty.value === "" ? null : Number(els.fQty.value),
    unit: els.fUnit.value.trim(),
    vendor: els.fVendor.value.trim(),
    notes: els.fNotes.value.trim(),
    checked: editingId ? (items.find(x=>x.id===editingId)?.checked ?? false) : false
  };

  if (editingId) {
    items = items.map(x => x.id === editingId ? payload : x);
  } else {
    items = [payload, ...items];
  }
  saveItems(items);
  render();
}

function clearAllTicks() {
  items = items.map(x => ({...x, checked:false}));
  saveItems(items);
  render();
}

function buildWhatsAppText() {
  const picked = items.filter(x => x.checked);
  if (!picked.length) return "Weekly Stock Up:\n(You didn’t tick anything yet.)";

  // Group by vendor then category
  const byVendor = new Map();
  for (const it of picked) {
    const vendor = (it.vendor || "Unknown vendor").trim();
    if (!byVendor.has(vendor)) byVendor.set(vendor, []);
    byVendor.get(vendor).push(it);
  }

  const lines = [];
  lines.push(`Weekly Stock Up (${new Date().toLocaleDateString()}):`);

  for (const [vendor, arr] of Array.from(byVendor.entries()).sort((a,b)=>a[0].localeCompare(b[0]))) {
    lines.push(`\n🛒 ${vendor}`);
    const byCat = new Map();
    for (const it of arr) {
      const cat = (it.category || "Other").trim();
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(it);
    }
    for (const [cat, list] of Array.from(byCat.entries()).sort((a,b)=>a[0].localeCompare(b[0]))) {
      lines.push(`  • ${cat}`);
      for (const it of list.sort((a,b)=>a.name.localeCompare(b.name))) {
        const qty = (it.qty ?? "") + (it.unit ? ` ${it.unit}` : "");
        const note = it.notes ? ` — ${it.notes}` : "";
        lines.push(`     - ${it.name}${qty.trim() ? ` (${qty.trim()})` : ""}${note}`);
      }
    }
  }

  return lines.join("\n");
}

function shareToWhatsApp() {
  const text = buildWhatsAppText();
  const url = "https://wa.me/?text=" + encodeURIComponent(text);
  window.open(url, "_blank");
}

function exportJson() {
  const blob = new Blob([JSON.stringify(items, null, 2)], {type:"application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "stockup-items.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJsonFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const incoming = JSON.parse(String(reader.result));
      if (!Array.isArray(incoming)) throw new Error("Invalid format");
      // basic sanitize
      items = incoming.map(x => ({
        id: x.id || uid(),
        name: String(x.name || "").trim(),
        category: String(x.category || "").trim(),
        qty: (x.qty === null || x.qty === undefined || x.qty === "") ? null : Number(x.qty),
        unit: String(x.unit || "").trim(),
        vendor: String(x.vendor || "").trim(),
        notes: String(x.notes || "").trim(),
        checked: Boolean(x.checked)
      })).filter(x => x.name);
      saveItems(items);
      render();
    } catch (e) {
      alert("Import failed: " + e.message);
    }
  };
  reader.readAsText(file);
}

// Events
els.search.addEventListener("input", render);
els.filterVendor.addEventListener("change", render);

els.btnShare.addEventListener("click", shareToWhatsApp);
els.btnReset.addEventListener("click", clearAllTicks);
els.btnAdd.addEventListener("click", () => openDialog("add"));
els.btnExport.addEventListener("click", exportJson);

els.importFile.addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) importJsonFile(f);
  e.target.value = "";
});

els.itemForm.addEventListener("submit", (e) => {
  e.preventDefault();
  upsertFromForm();
  els.dlg.close();
});

els.list.addEventListener("click", (e) => {
  const btn = e.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.getAttribute("data-act");
  const id = btn.getAttribute("data-id");
  const it = items.find(x => x.id === id);
  if (!it) return;

  if (act === "edit") openDialog("edit", it);
  if (act === "del") {
    if (confirm(`Delete "${it.name}"?`)) {
      items = items.filter(x => x.id !== id);
      saveItems(items);
      render();
    }
  }
});

els.list.addEventListener("change", (e) => {
  const cb = e.target.closest('input[type="checkbox"][data-act="toggle"]');
  if (!cb) return;
  const id = cb.getAttribute("data-id");
  items = items.map(x => x.id === id ? ({...x, checked: cb.checked}) : x);
  saveItems(items);
});

render();
