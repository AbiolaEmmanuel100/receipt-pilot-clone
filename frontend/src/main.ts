/**
 * Receipt Pilot-C — UI controller
 * Navigation, dashboard, receipts, and Stage 3A product catalogue.
 */

import type { Receipt, LineItem, CurrencyCode, PaymentStatus, Product } from "./types";
import { calculateReceipt, formatMoney, parseMoneyToCents, lineTotalCents } from "./calculations";
import { saveReceipt, listReceipts, getReceipt, deleteReceipt, generateId, saveProduct, listProducts, getProduct, softDeactivateProduct } from "./storage";
import { escapeHtml } from "./escape";
import { validateProduct, countLowStock, productInputFromForm, isLowStock } from "./products";

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
  return `<span class="badge ${cls}">${status}</span>`;
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
      recent.innerHTML = `<div class="empty-state">No receipts yet. Create your first one to see activity here.</div>`;
    } else {
      recent.innerHTML = `<ul class="records-list">${receipts.slice(0, 5).map((r) => `
        <li>
          <div><strong>${escapeHtml(r.receiptNumber)}</strong> · ${escapeHtml(r.customer.name || "—")}<br>
            <span class="muted">${r.receiptDate} · ${formatMoney(r.totalCents, r.currency)} ${statusBadge(r.paymentStatus)}</span>
          </div>
        </li>`).join("")}</ul>`;
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
  const receipts = await listReceipts();
  list.innerHTML = "";
  if (receipts.length === 0) {
    list.innerHTML = `<li class="empty-state">No receipts saved yet.</li>`;
    return;
  }
  for (const r of receipts) {
    const li = document.createElement("li");
    li.innerHTML = `
      <div>
        <strong>${escapeHtml(r.receiptNumber)}</strong> · ${escapeHtml(r.customer.name || "—")}
        <div class="muted">${r.receiptDate} · ${formatMoney(r.totalCents, r.currency)} ${statusBadge(r.paymentStatus)}</div>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" data-load="${r.id}">Edit</button>
        <button type="button" class="btn btn-danger" data-del="${r.id}">Delete</button>
      </div>
    `;
    li.querySelector("[data-load]")?.addEventListener("click", () => loadReceipt(r.id));
    li.querySelector("[data-del]")?.addEventListener("click", async () => {
      if (confirm("Delete this receipt from this device? This cannot be undone.")) {
        await deleteReceipt(r.id);
        if (currentReceiptId === r.id) resetForm();
        await refreshRecordsList();
        await refreshDashboard();
      }
    });
    list.appendChild(li);
  }
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
  if (products.length === 0) {
    container.innerHTML = `<div class="empty-state">${query ? "No products match your search." : "No products yet. Add your first product to track stock."}</div>`;
    return;
  }
  container.innerHTML = `<ul class="records-list">${products.map((p) => `
    <li>
      <div>
        <strong>${escapeHtml(p.name)}</strong> ${p.sku ? `· ${escapeHtml(p.sku)}` : ""}
        <div class="muted">${escapeHtml(p.category || "Uncategorised")} · Stock ${p.stockQty} · Sell ${formatMoney(p.sellingPriceCents)} · Cost ${formatMoney(p.costPriceCents)}
          ${isLowStock(p) ? `<span class="badge badge-unpaid">Low stock</span>` : ""}
        </div>
      </div>
      <div>
        <button type="button" class="btn btn-secondary" data-edit-prod="${escapeHtml(p.id)}">Edit</button>
        <button type="button" class="btn btn-danger" data-deact-prod="${escapeHtml(p.id)}">Deactivate</button>
      </div>
    </li>`).join("")}</ul>`;
  container.querySelectorAll("[data-edit-prod]").forEach((btn) => {
    btn.addEventListener("click", () => editProduct((btn as HTMLElement).dataset.editProd || ""));
  });
  container.querySelectorAll("[data-deact-prod]").forEach((btn) => {
    btn.addEventListener("click", () => deactivateProduct((btn as HTMLElement).dataset.deactProd || ""));
  });
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
  const product: Product = {
    id: editingProductId || generateId(),
    sku: input.sku,
    name: input.name,
    category: input.category,
    sellingPriceCents: input.sellingPriceCents,
    costPriceCents: input.costPriceCents,
    stockQty: input.stockQty,
    lowStockThreshold: input.lowStockThreshold,
    active: true,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
  await saveProduct(product);
  clearProductForm();
  showProductForm(false);
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
    refreshProductsList().catch(console.error);
  });

  refreshRecordsList().catch(console.error);
  refreshDashboard().catch(console.error);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
