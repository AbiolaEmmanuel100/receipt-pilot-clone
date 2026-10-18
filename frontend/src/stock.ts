/**
 * Stock movement and reconciliation logic (Stage 3B).
 * Pure functions — no DOM or IndexedDB.
 */

import type { Product, StockMovement, StockMovementInput, StockMovementType } from "./types";

const VALID_TYPES: StockMovementType[] = ["OPENING", "RESTOCK", "ADJUSTMENT", "COUNT"];

export function isValidMovementType(type: string): type is StockMovementType {
  return (VALID_TYPES as string[]).includes(type);
}

/**
 * Apply a signed quantity change to current stock.
 * Returns the new stock, or null if the result would be negative.
 */
export function applyQuantityChange(currentQty: number, change: number): number | null {
  if (!Number.isFinite(currentQty) || !Number.isFinite(change)) return null;
  const next = currentQty + change;
  if (next < 0) return null;
  return next;
}

/**
 * Sum of quantity changes. Used to verify product.stockQty matches history.
 */
export function stockFromMovements(movements: StockMovement[]): number {
  return movements.reduce((sum, m) => sum + (Number.isFinite(m.quantityChange) ? m.quantityChange : 0), 0);
}

export function validateMovement(input: StockMovementInput, currentQty: number): string[] {
  const errors: string[] = [];
  if (!input.productId) errors.push("Product is required.");
  if (!isValidMovementType(input.type)) errors.push("Invalid movement type.");
  if (!Number.isFinite(input.quantityChange) || input.quantityChange === 0) {
    errors.push("Quantity change must be a non-zero number.");
  }
  if (input.type === "RESTOCK" && input.quantityChange < 0) {
    errors.push("Restock quantity must be positive.");
  }
  if (input.type === "OPENING" && input.quantityChange < 0) {
    errors.push("Opening stock cannot be negative.");
  }
  if (!input.reason || !input.reason.trim()) {
    errors.push("A reason is required.");
  }
  const next = applyQuantityChange(currentQty, input.quantityChange);
  if (next === null) {
    errors.push("This movement would make stock negative.");
  }
  return errors;
}

/**
 * Physical count reconciliation.
 * Returns the quantity change needed to reach the counted quantity,
 * or an error if the count is invalid.
 */
export function reconcileCount(currentQty: number, countedQty: number): { change: number; error?: string } {
  if (!Number.isFinite(countedQty) || countedQty < 0) {
    return { change: 0, error: "Counted quantity must be zero or greater." };
  }
  if (!Number.isFinite(currentQty)) {
    return { change: 0, error: "Current stock is invalid." };
  }
  return { change: countedQty - currentQty };
}

export function expectedClosing(opening: number, received: number, adjustmentsOut: number): number {
  return opening + received - adjustmentsOut;
}

export function isConsistent(product: Product, movements: StockMovement[]): boolean {
  const forProduct = movements.filter((m) => m.productId === product.id);
  return stockFromMovements(forProduct) === product.stockQty;
}
