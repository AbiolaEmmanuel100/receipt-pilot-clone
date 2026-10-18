/**
 * Money calculations using integer cents to avoid floating-point errors.
 * All inputs and outputs that represent money are in minor units (cents).
 * Percentages are handled with care and rounded half-up to nearest cent.
 */

import type { CalculationInput, CalculationResult, PaymentStatus } from "./types";

/** Round a number to nearest integer using half-up (banker's not needed for receipts). */
function roundHalfUp(n: number): number {
  return Math.round(n + Number.EPSILON);
}

/** Convert a decimal quantity * price into cents, rounding half-up. */
export function lineTotalCents(quantity: number, unitPriceCents: number): number {
  if (!Number.isFinite(quantity) || !Number.isFinite(unitPriceCents)) return 0;
  if (quantity < 0 || unitPriceCents < 0) return 0;
  return roundHalfUp(quantity * unitPriceCents);
}

/**
 * Compute full receipt totals.
 * - Subtotal = sum of line totals
 * - Discount is subtracted (capped at subtotal)
 * - Tax is applied to (subtotal - discount)
 * - Balance = total - amount paid (can be negative if overpaid, but we clamp display later)
 */
export function calculateReceipt(input: CalculationInput): CalculationResult {
  const items = input.items || [];
  const discountCents = Math.max(0, Math.floor(input.discountCents || 0));
  const taxPercent = Math.max(0, input.taxPercent || 0);
  const amountPaidCents = Math.max(0, Math.floor(input.amountPaidCents || 0));

  let subtotalCents = 0;
  for (const item of items) {
    subtotalCents += lineTotalCents(item.quantity, item.unitPriceCents);
  }

  const effectiveDiscount = Math.min(discountCents, subtotalCents);
  const taxableCents = subtotalCents - effectiveDiscount;

  // tax = taxable * (taxPercent / 100), rounded half-up to cents
  const taxCents = roundHalfUp(taxableCents * (taxPercent / 100));

  const totalCents = taxableCents + taxCents;
  const balanceDueCents = totalCents - amountPaidCents;

  let paymentStatus: PaymentStatus = "UNPAID";
  if (amountPaidCents >= totalCents && totalCents > 0) {
    paymentStatus = "PAID";
  } else if (amountPaidCents > 0 && amountPaidCents < totalCents) {
    paymentStatus = "PARTIAL";
  } else if (totalCents === 0 && amountPaidCents === 0) {
    paymentStatus = "PAID"; // zero receipt considered settled
  }

  return {
    subtotalCents,
    discountCents: effectiveDiscount,
    taxableCents,
    taxCents,
    totalCents,
    amountPaidCents,
    balanceDueCents,
    paymentStatus,
  };
}

/** Format cents as a currency string (no symbol). */
export function formatMoney(cents: number, currency: string = ""): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = (abs % 100).toString().padStart(2, "0");
  const formatted = `${sign}${whole.toLocaleString("en-US")}.${frac}`;
  return currency ? `${currency} ${formatted}` : formatted;
}

/** Parse a user-entered decimal string into integer cents. Returns 0 on invalid. */
export function parseMoneyToCents(value: string | number): number {
  if (typeof value === "number") {
    if (!Number.isFinite(value) || value < 0) return 0;
    return roundHalfUp(value * 100);
  }
  const cleaned = String(value).trim().replace(/,/g, "");
  if (!cleaned || !/^-?\d*\.?\d*$/.test(cleaned)) return 0;
  const num = parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return roundHalfUp(num * 100);
}

/** Validate basic receipt input constraints. Returns list of error messages. */
export function validateCalculationInput(input: CalculationInput): string[] {
  const errors: string[] = [];
  if (!input.items || input.items.length === 0) {
    errors.push("At least one line item is required.");
  }
  for (const item of input.items || []) {
    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push("Quantity must be a positive number.");
    }
    if (!Number.isFinite(item.unitPriceCents) || item.unitPriceCents < 0) {
      errors.push("Unit price cannot be negative.");
    }
  }
  if (input.discountCents < 0) errors.push("Discount cannot be negative.");
  if (input.taxPercent < 0 || input.taxPercent > 100) errors.push("Tax percent must be between 0 and 100.");
  if (input.amountPaidCents < 0) errors.push("Amount paid cannot be negative.");
  return errors;
}
