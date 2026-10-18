/**
 * Receipt Pilot-C — UI controller
 * Navigation, dashboard, receipts, and Stage 3A product catalogue.
 */

import type { Receipt, LineItem, CurrencyCode, PaymentStatus, Product } from "./types";
import { calculateReceipt, formatMoney, parseMoneyToCents, lineTotalCents } from "./calculations";
import { saveReceipt, listReceipts, getReceipt, deleteReceipt, generateId, saveProduct, listProducts, getProduct, softDeactivateProduct, listMovements, recordMovementAndUpdateStock } from "./storage";
import { escapeHtml } from "./escape";
import { validateProduct, countLowStock, productInputFromForm, isLowStock } from "./products";
import { validateMovement, applyQuantityChange, reconcileCount } from "./stock";
import type { StockMovement, StockMovementType } from "./types";

const $ = <T extends Element = HTMLElement>(sel: string): T | null => document.querySelector(sel);

let currentReceiptId: string | null = null;
let items: LineItem[] = [];

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function nextReceiptNumber(): string {
  return "RCT-" + Date.now().toString().slice(-6);
}

function createEmptyItem(): LineItem {
  return { id: generateId(), name: "", quantity: 1, unitPriceCents: 0, lineTotalCents: 0 };
}

function statusBadge(status: string): string {
  const cls = status === "PAID" ? "badge-paid" : status === "PARTIAL" ? "badge-partial" : "badge-unpaid";
  const label = status === "PAID" ? "Paid" : status === "PARTIAL" ? "Partial" : "Unpaid";
  return `<span class="badge ${cls}"><span class="dot" aria-hidden="true"></span>${label}</span>`;
}

const PAGE_SIZE = 8;
const tableState: Record<string, { page: number; sort: string; dir: "asc" | "desc" }> = {
  receipts: { page: 0, sort: "date", dir: "desc" },
  products: { page: 0, sort: "name", dir: "asc" },
  movements: { page: 0, sort: "date", dir: "desc" },
};

function pagerHtml(key: string, total: number): string {
  const st = tableState[key];
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(st.page, pages - 1);
  st.page = page;
  return `<div class="pager">
    <span>${total} record${total === 1 ? "" : "s"} · page ${page + 1} of ${pages}</span>
    <span>
      <button type="button" class="btn btn-secondary btn-sm" data-page="${key}" data-dir="-1" ${page === 0 ? "disabled" : ""}>Previous</button>
      <button type="button" class="btn btn-secondary btn-sm" data-page="${key}" data-dir="1" ${page >= pages - 1 ? "disabled" : ""}>Next</button>
    </span>
  </div>`;
}

function bindPager(root: Element, key: string, refresh: () => void): void {
  root.querySelectorAll("[data-page]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const dir = Number((btn as HTMLElement).dataset.dir || "0");
      tableState[key].page += dir;
      refresh();
    });
  });
  root.querySelectorAll("th[data-sort]").forEach((th) => {
    th.addEventListener("click", () => {
      const sort = (th as HTMLElement).dataset.sort || "";
      if (tableState[key].sort === sort) {
        tableState[key].dir = tableState[key].dir === "asc" ? "desc" : "asc";
      } else {
        tableState[key].sort = sort;
        tableState[key].dir = "asc";
      }
      tableState[key].page = 0;
      refresh();
    });
  });
}

/* ---------- Navigation ---------- */
function showPage(page: string): void {
  document.querySelectorAll(".page").forEach((el) => el.classList.remove("active"));
  document.querySelectorAll(".nav-item").forEach((el) => el.classList.remove("active"));
  const target = $(`#page-${page}`);
  const nav = document.querySelector(`.nav-item[data-page="${page}"]`);
  if (target) target.classList.add("active");
  if (nav) nav.classList.add("active");
  const title = $("#page-title");
  if (title) {
    const labels: Record<string, string> = {
      dashboard: "Dashboard",
      receipts: "Receipts",
      sales: "Sales",
      products: "Products & Inventory",
      restock: "Restocking & Purchases",
      expenses: "Expenses",
      customers: "Customers",
      reports: "Reports",
      settings: "Settings",
    };
    title.textContent = labels[page] || "Receipt Pilot-C";
  }
  $("#sidebar")?.classList.remove("open");
  if (page === "dashboard") refreshDashboard();
  if (page === "products") refreshProductsList();
  if (page === "restock") refreshMovementsPage();
}

/* ---------- Dashboard ---------- */
async function refreshDashboard(): Promise<void> {
  const receipts = await listReceipts();
  const today = todayISO();
  const todayReceipts = receipts.filter((r) => r.receiptDate === today);
  const todayTotal = todayReceipts.reduce((s, r) => s + r.totalCents, 0);
  const outstanding = receipts.reduce((s, r) => s + Math.max(0, r.balanceDueCents), 0);

  const set = (id: string, val: string) => {
    const el = $(id);
    if (el) el.textContent = val;
  };
  set("#metric-today", formatMoney(todayTotal));
  set("#metric-outstanding", formatMoney(outstanding));
  set("#metric-count", String(todayReceipts.length));

  const products = await listProducts(true);
  set("#metric-lowstock", String(countLowStock(products)));

  const greet = $("#greeting");
  if (greet) {
    const h = new Date().getHours();
    const g = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
    greet.textContent = g;
  }
  const dateEl = $("#today-date");
  if (dateEl) dateEl.textContent = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

  const recent = $("#dashboard-recent");
  if (recent) {
    if (receipts.length === 0) {
      recent.innerHTML = `<div class="empty-state"><div class="empty-icon">☰</div><h3>No receipts yet</h3><p>Create your first receipt to see today’s activity here.</p></div>`;
    } else {
      recent.innerHTML = `<div class="table-wrap"><table class="data-table">
        <thead><tr>
          <th class="nosort">Number</th><th class="nosort">Date</th><th class="nosort">Customer</th>
          <th class="nosort num">Total</th><th class="nosort">Status</th>
        </tr></thead>
        <tbody>${receipts.slice(0, 5).map((r) => `
          <tr>
            <td>${escapeHtml(r.receiptNumber)}</td>
            <td>${escapeHtml(r.receiptDate)}</td>
            <td>${escapeHtml(r.customer.name || "Walk-in")}</td>
            <td class="num">${formatMoney(r.totalCents, r.currency)}</td>
            <td>${statusBadge(r.paymentStatus)}</td>
          </tr>`).join("")}</tbody></table></div>`;
    }
  }
}

/* ---------- Receipt form ---------- */
function readForm() {
  return {
    business: {
      name: ($("#biz-name") as HTMLInputElement)?.value.trim() || "",
      address: ($("#biz-address") as HTMLTextAreaElement)?.value.trim() || "",
      phone: ($("#biz-phone") as HTMLInputElement)?.value.trim() || "",
      email: ($("#biz-email") as HTMLInputElement)?.value.trim() || "",
      website: ($("#biz-website") as HTMLInputElement)?.value.trim() || "",
      footer: ($("#biz-footer") as HTMLInputElement)?.value.trim() || "",
    },
    customer: {
      name: ($("#cust-name") as HTMLInputElement)?.value.trim() || "",
      phone: ($("#cust-phone") as HTMLInputElement)?.value.trim() || "",
      email: ($("#cust-email") as HTMLInputElement)?.value.trim() || "",
    },
    discountCents: parseMoneyToCents(($("#discount") as HTMLInputElement)?.value || "0"),
    taxPercent: parseFloat(($("#tax-pct") as HTMLInputElement)?.value || "0") || 0,
    amountPaidCents: parseMoneyToCents(($("#amount-paid") as HTMLInputElement)?.value || "0"),
    currency: (($("#currency") as HTMLSelectElement)?.value as CurrencyCode) || "NGN",
    paymentMethod: ($("#payment-method") as HTMLSelectElement)?.value || "Cash",
    receiptDate: ($("#receipt-date") as HTMLInputElement)?.value || todayISO(),
    receiptNumber: ($("#receipt-number") as HTMLInputElement)?.value.trim() || nextReceiptNumber(),
    notes: ($("#notes") as HTMLTextAreaElement)?.value.trim() || "",
    paymentStatus: (($("#payment-status") as HTMLSelectElement)?.value as PaymentStatus) || "UNPAID",
  };
}

function updateCalculationsAndPreview(): void {
  const form = readForm();
  const result = calculateReceipt({
    items: items.map((it) => ({ quantity: it.quantity, unitPriceCents: it.unitPriceCents })),
    discountCents: form.discountCents,
    taxPercent: form.taxPercent,
    amountPaidCents: form.amountPaidCents,
  });
  const statusEl = $("#payment-status") as HTMLSelectElement | null;
  if (statusEl) statusEl.value = result.paymentStatus;
  renderPreview(form, result);
}

function renderItems(): void {
  const container = $("#items-container");
  if (!container) return;
  container.innerHTML = "";
  items.forEach((item, index) => {
    const row = document.createElement("div");
    row.className = "item-row";
    row.innerHTML = `
      <label>Item<input type="text" data-k="name" value="${escapeHtml(item.name)}" placeholder="Description" /></label>
      <label>Qty<input type="number" data-k="qty" min="0.01" step="0.01" value="${item.quantity}" /></label>
      <label>Unit price<input type="number" data-k="price" min="0" step="0.01" value="${(item.unitPriceCents / 100).toFixed(2)}" /></label>
      <label>Line total<input type="text" data-k="total" value="${formatMoney(item.lineTotalCents)}" readonly /></label>
      <button type="button" class="btn btn-danger" data-action="remove" ${items.length <= 1 ? "disabled" : ""}>×</button>
    `;
    row.querySelectorAll("input").forEach((inp) => {
      inp.addEventListener("input", () => {
        const nameEl = row.querySelector("[data-k=name]") as HTMLInputElement;
        const qtyEl = row.querySelector("[data-k=qty]") as HTMLInputElement;
        const priceEl = row.querySelector("[data-k=price]") as HTMLInputElement;
        items[index].name = nameEl.value;
        items[index].quantity = parseFloat(qtyEl.value) || 0;
        items[index].unitPriceCents = parseMoneyToCents(priceEl.value);
        items[index].lineTotalCents = lineTotalCents(items[index].quantity, items[index].unitPriceCents);
        (row.querySelector("[data-k=total]") as HTMLInputElement).value = formatMoney(items[index].lineTotalCents);
        updateCalculationsAndPreview();
      });
    });
    row.querySelector("[data-action=remove]")?.addEventListener("click", () => {
      if (items.length > 1) {
        items.splice(index, 1);
        renderItems();
        updateCalculationsAndPreview();
      }
    });
    container.appendChild(row);
  });
}

function renderPreview(form: ReturnType<typeof readForm>, result: ReturnType<typeof calculateReceipt>): void {
  const preview = $("#receipt-preview");
  if (!preview) return;
  const cur = form.currency;
  preview.innerHTML = `
    <h3 style="margin:0 0 0.25rem">${escapeHtml(form.business.name || "Business Name")}</h3>
    <div class="muted">${escapeHtml(form.business.address).replace(/\n/g, "<br>")}</div>
    <div class="muted">${escapeHtml(form.business.phone)} ${escapeHtml(form.business.email)}</div>
    <hr />
    <div><strong>Receipt</strong> ${escapeHtml(form.receiptNumber)}</div>
    <div class="muted">${form.receiptDate} · ${statusBadge(result.paymentStatus)}</div>
    <div><strong>Bill to:</strong> ${escapeHtml(form.customer.name || "Customer")}</div>
    <table>
      <thead><tr><th>Item</th><th>Qty</th><th>Price</th><th>Total</th></tr></thead>
      <tbody>
        ${items.map((it) => `<tr><td>${escapeHtml(it.name || "Item")}</td><td>${it.quantity}</td><td>${formatMoney(it.unitPriceCents)}</td><td>${formatMoney(it.lineTotalCents)}</td></tr>`).join("")}
      </tbody>
    </table>
    <div class="totals">
      <div><span>Subtotal</span><span>${formatMoney(result.subtotalCents, cur)}</span></div>
      <div><span>Discount</span><span>-${formatMoney(result.discountCents, cur)}</span></div>
      <div><span>Tax (${form.taxPercent}%)</span><span>${formatMoney(result.taxCents, cur)}</span></div>
      <div class="grand"><span>Total</span><span>${formatMoney(result.totalCents, cur)}</span></div>
      <div><span>Paid</span><span>${formatMoney(result.amountPaidCents, cur)}</span></div>
      <div><span>Balance due</span><span>${formatMoney(result.balanceDueCents, cur)}</span></div>
    </div>
    ${form.notes ? `<div class="muted" style="margin-top:0.75rem">${escapeHtml(form.notes)}</div>` : ""}
    ${form.business.footer ? `<div style="margin-top:0.75rem;text-align:center">${escapeHtml(form.business.footer)}</div>` : ""}
  `;
}

async function saveCurrent(): Promise<void> {
  const form = readForm();
  if (!form.business.name) {
    alert("Business name is required.");
    return;
  }
  const result = calculateReceipt({
    items: items.map((it) => ({ quantity: it.quantity, unitPriceCents: it.unitPriceCents })),
    discountCents: form.discountCents,
    taxPercent: form.taxPercent,
    amountPaidCents: form.amountPaidCents,
  });
  const now = new Date().toISOString();
  const existing = currentReceiptId ? await getReceipt(currentReceiptId) : null;
  const receipt: Receipt = {
    id: currentReceiptId || generateId(),
    receiptNumber: form.receiptNumber,
    business: form.business,
    customer: form.customer,
    items: items.map((it) => ({ ...it })),
    discountCents: result.discountCents,
    taxPercent: form.taxPercent,
    taxCents: result.taxCents,
    subtotalCents: result.subtotalCents,
    totalCents: result.totalCents,
    amountPaidCents: result.amountPaidCents,
    balanceDueCents: result.balanceDueCents,
    paymentStatus: result.paymentStatus,
    paymentMethod: form.paymentMethod,
    currency: form.currency,
    receiptDate: form.receiptDate,
    notes: form.notes,
    templateId: "classic",
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await saveReceipt(receipt);
  currentReceiptId = receipt.id;
  await refreshRecordsList();
  await refreshDashboard();
  alert("Receipt saved locally on this device.");
}

function resetForm(): void {
  currentReceiptId = null;
  items = [createEmptyItem()];
  ($("#receipt-form") as HTMLFormElement)?.reset();
  ($("#receipt-date") as HTMLInputElement).value = todayISO();
  ($("#receipt-number") as HTMLInputElement).value = nextReceiptNumber();
  renderItems();
  updateCalculationsAndPreview();
}

async function loadReceipt(id: string): Promise<void> {
  const r = await getReceipt(id);
  if (!r) return;
  currentReceiptId = r.id;
  ($("#biz-name") as HTMLInputElement).value = r.business.name;
  ($("#biz-address") as HTMLTextAreaElement).value = r.business.address;
  ($("#biz-phone") as HTMLInputElement).value = r.business.phone;
  ($("#biz-email") as HTMLInputElement).value = r.business.email;
  ($("#biz-website") as HTMLInputElement).value = r.business.website;
  ($("#biz-footer") as HTMLInputElement).value = r.business.footer;
  ($("#cust-name") as HTMLInputElement).value = r.customer.name;
  ($("#cust-phone") as HTMLInputElement).value = r.customer.phone;
  ($("#cust-email") as HTMLInputElement).value = r.customer.email;
  ($("#discount") as HTMLInputElement).value = (r.discountCents / 100).toFixed(2);
  ($("#tax-pct") as HTMLInputElement).value = String(r.taxPercent);
  ($("#amount-paid") as HTMLInputElement).value = (r.amountPaidCents / 100).toFixed(2);
  ($("#currency") as HTMLSelectElement).value = r.currency;
  ($("#payment-method") as HTMLSelectElement).value = r.paymentMethod;
  ($("#payment-status") as HTMLSelectElement).value = r.paymentStatus;
  ($("#receipt-date") as HTMLInputElement).value = r.receiptDate;
  ($("#receipt-number") as HTMLInputElement).value = r.receiptNumber;
  ($("#notes") as HTMLTextAreaElement).value = r.notes;
  items = r.items.map((it) => ({ ...it }));
  renderItems();
  updateCalculationsAndPreview();
  showPage("receipts");
}

async function refreshRecordsList(): Promise<void> {
  const list = $("#records-list");
  if (!list) return;
  const q = (($("#receipt-search") as HTMLInputElement)?.value || "").trim().toLowerCase();
  let receipts = await listReceipts();
  if (q) {
    receipts = receipts.filter((r) =>
      r.receiptNumber.toLowerCase().includes(q) || (r.customer.name || "").toLowerCase().includes(q)
    );
  }
  const st = tableState.receipts;
  receipts.sort((a, b) => {
    const dir = st.dir === "asc" ? 1 : -1;
    if (st.sort === "number") return a.receiptNumber.localeCompare(b.receiptNumber) * dir;
    if (st.sort === "customer") return (a.customer.name || "").localeCompare(b.customer.name || "") * dir;
    if (st.sort === "total") return (a.totalCents - b.totalCents) * dir;
    if (st.sort === "status") return a.paymentStatus.localeCompare(b.paymentStatus) * dir;
    return a.receiptDate.localeCompare(b.receiptDate) * dir;
  });
  if (receipts.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">☰</div><h3>${q ? "No matches" : "No receipts saved"}</h3><p>${q ? "Try another number or customer name." : "Save a receipt to keep it on this device."}</p></div>`;
    return;
  }
  const page = receipts.slice(st.page * PAGE_SIZE, st.page * PAGE_SIZE + PAGE_SIZE);
  list.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th data-sort="number">Number</th>
      <th data-sort="date">Date</th>
      <th data-sort="customer">Customer</th>
      <th data-sort="total" class="num">Total</th>
      <th class="nosort">Method</th>
      <th data-sort="status">Status</th>
      <th class="nosort">Actions</th>
    </tr></thead>
    <tbody>${page.map((r) => `
      <tr>
        <td>${escapeHtml(r.receiptNumber)}</td>
        <td>${escapeHtml(r.receiptDate)}</td>
        <td>${escapeHtml(r.customer.name || "Walk-in")}</td>
        <td class="num">${formatMoney(r.totalCents, r.currency)}</td>
        <td>${escapeHtml(r.paymentMethod || "—")}</td>
        <td>${statusBadge(r.paymentStatus)}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-secondary btn-sm" data-load="${escapeHtml(r.id)}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm" data-del="${escapeHtml(r.id)}">Delete</button>
        </td>
      </tr>`).join("")}</tbody></table></div>${pagerHtml("receipts", receipts.length)}`;
  list.querySelectorAll("[data-load]").forEach((btn) => {
    btn.addEventListener("click", () => loadReceipt((btn as HTMLElement).dataset.load || ""));
  });
  list.querySelectorAll("[data-del]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const id = (btn as HTMLElement).dataset.del || "";
      if (confirm("Delete this receipt from this device? This cannot be undone.")) {
        await deleteReceipt(id);
        if (currentReceiptId === id) resetForm();
        await refreshRecordsList();
        await refreshDashboard();
      }
    });
  });
  bindPager(list, "receipts", () => { refreshRecordsList().catch(console.error); });
}

/* ---------- Products (Stage 3A) ---------- */
let editingProductId: string | null = null;

function showProductForm(show: boolean): void {
  const wrap = $("#product-form-wrap");
  if (wrap) wrap.style.display = show ? "block" : "none";
}

function clearProductForm(): void {
  ($("#prod-name") as HTMLInputElement).value = "";
  ($("#prod-sku") as HTMLInputElement).value = "";
  ($("#prod-category") as HTMLInputElement).value = "";
  ($("#prod-stock") as HTMLInputElement).value = "0";
  ($("#prod-sell") as HTMLInputElement).value = "0";
  ($("#prod-cost") as HTMLInputElement).value = "0";
  ($("#prod-threshold") as HTMLInputElement).value = "0";
  const err = $("#product-errors");
  if (err) err.textContent = "";
  editingProductId = null;
  const title = $("#product-form-title");
  if (title) title.textContent = "Add product";
}

async function refreshProductsList(): Promise<void> {
  const container = $("#products-list");
  if (!container) return;
  const query = (($("#product-search") as HTMLInputElement)?.value || "").trim().toLowerCase();
  let products = await listProducts(false);
  if (query) {
    products = products.filter((p) =>
      p.name.toLowerCase().includes(query) ||
      p.sku.toLowerCase().includes(query) ||
      p.category.toLowerCase().includes(query)
    );
  }
  const st = tableState.products;
  products.sort((a, b) => {
    const dir = st.dir === "asc" ? 1 : -1;
    if (st.sort === "sku") return a.sku.localeCompare(b.sku) * dir;
    if (st.sort === "stock") return (a.stockQty - b.stockQty) * dir;
    if (st.sort === "sell") return (a.sellingPriceCents - b.sellingPriceCents) * dir;
    return a.name.localeCompare(b.name) * dir;
  });
  if (products.length === 0) {
    container.innerHTML = `<div class="empty-state"><div class="empty-icon">▣</div><h3>${query ? "No matches" : "No products yet"}</h3><p>${query ? "Try a different name, SKU, or category." : "Add your first product to track price and stock."}</p></div>`;
    return;
  }
  const page = products.slice(st.page * PAGE_SIZE, st.page * PAGE_SIZE + PAGE_SIZE);
  container.innerHTML = `<div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th data-sort="sku">SKU</th>
      <th data-sort="name">Name</th>
      <th class="nosort">Category</th>
      <th data-sort="sell" class="num">Selling</th>
      <th class="nosort num">Cost</th>
      <th data-sort="stock" class="num">Qty</th>
      <th class="nosort num">Low at</th>
      <th class="nosort">Status</th>
      <th class="nosort">Actions</th>
    </tr></thead>
    <tbody>${page.map((p) => {
      const low = isLowStock(p);
      const out = p.stockQty <= 0;
      const status = out
        ? `<span class="badge badge-unpaid"><span class="dot"></span>Out of stock</span>`
        : low
          ? `<span class="badge badge-partial"><span class="dot"></span>Low stock</span>`
          : `<span class="badge badge-paid"><span class="dot"></span>In stock</span>`;
      return `<tr>
        <td>${escapeHtml(p.sku || "—")}</td>
        <td>${escapeHtml(p.name)}</td>
        <td>${escapeHtml(p.category || "—")}</td>
        <td class="num">${formatMoney(p.sellingPriceCents)}</td>
        <td class="num">${formatMoney(p.costPriceCents)}</td>
        <td class="num">${p.stockQty}</td>
        <td class="num">${p.lowStockThreshold}</td>
        <td>${status}</td>
        <td class="actions-cell">
          <button type="button" class="btn btn-secondary btn-sm" data-edit-prod="${escapeHtml(p.id)}">Edit</button>
          <button type="button" class="btn btn-danger btn-sm" data-deact-prod="${escapeHtml(p.id)}">Deactivate</button>
        </td>
      </tr>`;
    }).join("")}</tbody></table></div>${pagerHtml("products", products.length)}`;
  container.querySelectorAll("[data-edit-prod]").forEach((btn) => {
    btn.addEventListener("click", () => editProduct((btn as HTMLElement).dataset.editProd || ""));
  });
  container.querySelectorAll("[data-deact-prod]").forEach((btn) => {
    btn.addEventListener("click", () => deactivateProduct((btn as HTMLElement).dataset.deactProd || ""));
  });
  bindPager(container, "products", () => { refreshProductsList().catch(console.error); });
}

async function editProduct(id: string): Promise<void> {
  const p = await getProduct(id);
  if (!p) return;
  editingProductId = p.id;
  ($("#prod-name") as HTMLInputElement).value = p.name;
  ($("#prod-sku") as HTMLInputElement).value = p.sku;
  ($("#prod-category") as HTMLInputElement).value = p.category;
  ($("#prod-stock") as HTMLInputElement).value = String(p.stockQty);
  ($("#prod-sell") as HTMLInputElement).value = (p.sellingPriceCents / 100).toFixed(2);
  ($("#prod-cost") as HTMLInputElement).value = (p.costPriceCents / 100).toFixed(2);
  ($("#prod-threshold") as HTMLInputElement).value = String(p.lowStockThreshold);
  const title = $("#product-form-title");
  if (title) title.textContent = "Edit product";
  showProductForm(true);
}

async function deactivateProduct(id: string): Promise<void> {
  if (!confirm("Deactivate this product? It will be hidden from the active list but kept for history.")) return;
  await softDeactivateProduct(id);
  await refreshProductsList();
  await refreshDashboard();
}

async function saveProductFromForm(e: Event): Promise<void> {
  e.preventDefault();
  const input = productInputFromForm({
    sku: ($("#prod-sku") as HTMLInputElement).value,
    name: ($("#prod-name") as HTMLInputElement).value,
    category: ($("#prod-category") as HTMLInputElement).value,
    sellingPrice: ($("#prod-sell") as HTMLInputElement).value,
    costPrice: ($("#prod-cost") as HTMLInputElement).value,
    stockQty: ($("#prod-stock") as HTMLInputElement).value,
    lowStockThreshold: ($("#prod-threshold") as HTMLInputElement).value,
    active: true,
  });
  const all = await listProducts(true);
  const otherSkus = all.filter((p) => p.id !== editingProductId).map((p) => p.sku);
  const errors = validateProduct(input, otherSkus);
  const errEl = $("#product-errors");
  if (errors.length) {
    if (errEl) errEl.textContent = errors.join(" ");
    return;
  }
  const now = new Date().toISOString();
  const existing = editingProductId ? await getProduct(editingProductId) : null;
  if (existing && input.stockQty !== existing.stockQty) {
    const delta = input.stockQty - existing.stockQty;
    const adjCheck = validateMovement(
      { productId: existing.id, type: "ADJUSTMENT", quantityChange: delta, reason: "Stock edited on product form" },
      existing.stockQty
    );
    if (adjCheck.length) {
      if (errEl) errEl.textContent = adjCheck.join(" ");
      return;
    }
  }
  const product: Product = {
    id: editingProductId || generateId(),
    sku: input.sku,
    name: input.name,
    category: input.category,
    sellingPriceCents: input.sellingPriceCents,
    costPriceCents: input.costPriceCents,
    stockQty: existing ? existing.stockQty : input.stockQty,
    lowStockThreshold: input.lowStockThreshold,
    active: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await saveProduct(product);
  if (!existing && product.stockQty > 0) {
    const opening: StockMovement = {
      id: generateId(),
      productId: product.id,
      type: "OPENING",
      quantityChange: product.stockQty,
      reason: "Opening stock on create",
      createdAt: now,
    };
    await recordMovementAndUpdateStock(opening, product.stockQty);
  } else if (existing && input.stockQty !== existing.stockQty) {
    const delta = input.stockQty - existing.stockQty;
    const adj: StockMovement = {
      id: generateId(),
      productId: product.id,
      type: "ADJUSTMENT",
      quantityChange: delta,
      reason: "Stock edited on product form",
      createdAt: now,
    };
    await recordMovementAndUpdateStock(adj, input.stockQty);
  }
  clearProductForm();
  showProductForm(false);
  await refreshProductsList();
  await refreshDashboard();
}

/* ---------- Stock movements (Stage 3B) ---------- */
async function refreshMovementsPage(): Promise<void> {
  const select = $("#mov-product") as HTMLSelectElement | null;
  const products = await listProducts(false);
  if (select) {
    const current = select.value;
    select.innerHTML = products.length
      ? products.map((p) => `<option value="${escapeHtml(p.id)}">${escapeHtml(p.name)} (${p.stockQty})</option>`).join("")
      : `<option value="">No products</option>`;
    if (current) select.value = current;
  }
  updateMovementHint();
  const list = $("#movements-list");
  if (!list) return;
  const typeFilter = ($("#mov-filter") as HTMLSelectElement)?.value || "";
  let movements = await listMovements();
  if (typeFilter) movements = movements.filter((m) => m.type === typeFilter);
  const st = tableState.movements;
  movements.sort((a, b) => {
    const dir = st.dir === "asc" ? 1 : -1;
    if (st.sort === "type") return a.type.localeCompare(b.type) * dir;
    if (st.sort === "qty") return (a.quantityChange - b.quantityChange) * dir;
    return a.createdAt.localeCompare(b.createdAt) * dir;
  });
  if (movements.length === 0) {
    list.innerHTML = `<div class="empty-state"><div class="empty-icon">↔</div><h3>No movements yet</h3><p>Restocks, adjustments, and counts will appear here. No sample movements are shown.</p></div>`;
    return;
  }
  const nameOf = (id: string) => products.find((p) => p.id === id)?.name || "Unknown product";
  const currentOf = (id: string) => {
    const p = products.find((x) => x.id === id);
    return p ? String(p.stockQty) : "—";
  };
  const page = movements.slice(st.page * PAGE_SIZE, st.page * PAGE_SIZE + PAGE_SIZE);
  list.innerHTML = `<p class="muted" style="font-size:0.8rem;margin:0 0 0.4rem">Current stock is the product’s present quantity, not a reconstructed historical balance.</p>
    <div class="table-wrap"><table class="data-table">
    <thead><tr>
      <th data-sort="date">Date</th>
      <th class="nosort">Product</th>
      <th data-sort="type">Type</th>
      <th data-sort="qty" class="num">Change</th>
      <th class="nosort">Reason</th>
      <th class="nosort num">Current stock</th>
    </tr></thead>
    <tbody>${page.map((m) => `
      <tr>
        <td>${escapeHtml(new Date(m.createdAt).toLocaleString())}</td>
        <td>${escapeHtml(nameOf(m.productId))}</td>
        <td><span class="badge badge-neutral">${escapeHtml(m.type)}</span></td>
        <td class="num">${m.quantityChange > 0 ? "+" : ""}${m.quantityChange}</td>
        <td>${escapeHtml(m.reason)}</td>
        <td class="num">${currentOf(m.productId)}</td>
      </tr>`).join("")}</tbody></table></div>${pagerHtml("movements", movements.length)}`;
  bindPager(list, "movements", () => { refreshMovementsPage().catch(console.error); });
}

function updateMovementHint(): void {
  const type = ($("#mov-type") as HTMLSelectElement)?.value;
  const hint = $("#mov-hint");
  const qty = $("#mov-qty") as HTMLInputElement | null;
  if (!hint || !qty) return;
  if (type === "COUNT") {
    hint.textContent = "Enter the physical quantity you counted. The system will record the difference.";
    qty.min = "0";
  } else if (type === "ADJUSTMENT") {
    hint.textContent = "Enter a positive number to add stock, or a negative number to remove it.";
    qty.removeAttribute("min");
  } else {
    hint.textContent = "Enter a positive quantity received or set as opening stock.";
    qty.min = "1";
  }
}

async function submitMovement(e: Event): Promise<void> {
  e.preventDefault();
  const errEl = $("#mov-errors");
  if (errEl) errEl.textContent = "";
  const productId = ($("#mov-product") as HTMLSelectElement)?.value || "";
  const type = (($("#mov-type") as HTMLSelectElement)?.value || "RESTOCK") as StockMovementType;
  const rawQty = parseFloat(($("#mov-qty") as HTMLInputElement)?.value || "0");
  const reason = ($("#mov-reason") as HTMLInputElement)?.value.trim() || "";
  const product = productId ? await getProduct(productId) : null;
  if (!product) {
    if (errEl) errEl.textContent = "Select a product.";
    return;
  }
  let change = rawQty;
  if (type === "COUNT") {
    const rec = reconcileCount(product.stockQty, rawQty);
    if (rec.error) {
      if (errEl) errEl.textContent = rec.error;
      return;
    }
    if (rec.change === 0) {
      if (errEl) errEl.textContent = "Count matches current stock. No movement recorded.";
      return;
    }
    change = rec.change;
  } else if (type === "RESTOCK" || type === "OPENING") {
    change = Math.abs(rawQty);
  }
  const input = { productId, type, quantityChange: change, reason };
  const errors = validateMovement(input, product.stockQty);
  if (errors.length) {
    if (errEl) errEl.textContent = errors.join(" ");
    return;
  }
  const next = applyQuantityChange(product.stockQty, change);
  if (next === null) {
    if (errEl) errEl.textContent = "This movement would make stock negative.";
    return;
  }
  const movement: StockMovement = {
    id: generateId(),
    productId,
    type,
    quantityChange: change,
    reason,
    createdAt: new Date().toISOString(),
  };
  await recordMovementAndUpdateStock(movement, next);
  ($("#mov-reason") as HTMLInputElement).value = "";
  await refreshMovementsPage();
  await refreshProductsList();
  await refreshDashboard();
}

/* ---------- Init ---------- */
function init(): void {
  items = [createEmptyItem()];
  ($("#receipt-date") as HTMLInputElement).value = todayISO();
  ($("#receipt-number") as HTMLInputElement).value = nextReceiptNumber();
  renderItems();
  updateCalculationsAndPreview();

  // Navigation
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => showPage((btn as HTMLElement).dataset.page || "dashboard"));
  });
  $("#menu-toggle")?.addEventListener("click", () => $("#sidebar")?.classList.toggle("open"));
  $("#quick-new-receipt")?.addEventListener("click", () => {
    resetForm();
    showPage("receipts");
  });
  document.querySelectorAll("[data-goto]").forEach((el) => {
    el.addEventListener("click", () => showPage((el as HTMLElement).dataset.goto || "dashboard"));
  });

  // Form events
  $("#add-item")?.addEventListener("click", () => {
    items.push(createEmptyItem());
    renderItems();
  });
  ["#discount", "#tax-pct", "#amount-paid", "#currency", "#payment-method"].forEach((sel) => {
    $(sel)?.addEventListener("input", updateCalculationsAndPreview);
    $(sel)?.addEventListener("change", updateCalculationsAndPreview);
  });
  document.querySelectorAll("#receipt-form input, #receipt-form textarea, #receipt-form select").forEach((el) => {
    el.addEventListener("input", updateCalculationsAndPreview);
  });
  $("#receipt-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    try {
      await saveCurrent();
    } catch (err) {
      console.error(err);
      alert("Failed to save receipt. Please try again.");
    }
  });
  $("#new-receipt")?.addEventListener("click", resetForm);
  $("#print-preview")?.addEventListener("click", () => window.print());

  $("#new-product")?.addEventListener("click", () => {
    clearProductForm();
    showProductForm(true);
  });
  $("#cancel-product")?.addEventListener("click", () => {
    clearProductForm();
    showProductForm(false);
  });
  $("#product-form")?.addEventListener("submit", (e) => {
    saveProductFromForm(e).catch((err) => {
      console.error(err);
      const errEl = $("#product-errors");
      if (errEl) errEl.textContent = "Could not save product. Please try again.";
    });
  });
  $("#product-search")?.addEventListener("input", () => {
    tableState.products.page = 0;
    refreshProductsList().catch(console.error);
  });
  $("#receipt-search")?.addEventListener("input", () => {
    tableState.receipts.page = 0;
    refreshRecordsList().catch(console.error);
  });
  $("#mov-filter")?.addEventListener("change", () => {
    tableState.movements.page = 0;
    refreshMovementsPage().catch(console.error);
  });

  $("#movement-form")?.addEventListener("submit", (e) => {
    submitMovement(e).catch((err) => {
      console.error(err);
      const errEl = $("#mov-errors");
      if (errEl) errEl.textContent = "Could not record movement. Please try again.";
    });
  });
  $("#mov-type")?.addEventListener("change", updateMovementHint);

  refreshRecordsList().catch(console.error);
  refreshDashboard().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
