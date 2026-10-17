/**
 * Product catalogue helpers (Stage 3A).
 * Pure functions for validation and low-stock logic — no DOM or IndexedDB.
 */

import type { Product, ProductInput } from "./types";
import { parseMoneyToCents } from "./calculations";

export function normalizeSku(sku: string): string {
  return sku.trim().toUpperCase();
}

export function validateProduct(input: ProductInput, existingSkus: string[] = [], currentId?: string): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) {
    errors.push("Product name is required.");
  }
  if (input.sellingPriceCents < 0) errors.push("Selling price cannot be negative.");
  if (input.costPriceCents < 0) errors.push("Cost price cannot be negative.");
  if (!Number.isFinite(input.stockQty) || input.stockQty < 0) {
    errors.push("Stock quantity cannot be negative.");
  }
  if (!Number.isFinite(input.lowStockThreshold) || input.lowStockThreshold < 0) {
    errors.push("Low-stock threshold cannot be negative.");
  }
  const sku = normalizeSku(input.sku);
  if (sku) {
    const clash = existingSkus.some((s) => normalizeSku(s) === sku && s !== currentId);
    // existingSkus is list of skus from other products; caller should exclude current
    if (clash) errors.push("A product with this SKU already exists.");
  }
  return errors;
}

export function isLowStock(p: Product): boolean {
  return p.active && p.stockQty <= p.lowStockThreshold;
}

export function countLowStock(products: Product[]): number {
  return products.filter(isLowStock).length;
}

export function productInputFromForm(fields: {
  sku: string;
  name: string;
  category: string;
  sellingPrice: string | number;
  costPrice: string | number;
  stockQty: string | number;
  lowStockThreshold: string | number;
  active: boolean;
}): ProductInput {
  const qty = typeof fields.stockQty === "number" ? fields.stockQty : parseFloat(fields.stockQty);
  const thr = typeof fields.lowStockThreshold === "number" ? fields.lowStockThreshold : parseFloat(fields.lowStockThreshold);
  return {
    sku: fields.sku.trim(),
    name: fields.name.trim(),
    category: fields.category.trim(),
    sellingPriceCents: parseMoneyToCents(fields.sellingPrice),
    costPriceCents: parseMoneyToCents(fields.costPrice),
    stockQty: Number.isFinite(qty) ? qty : 0,
    lowStockThreshold: Number.isFinite(thr) ? thr : 0,
    active: fields.active,
  };
}
