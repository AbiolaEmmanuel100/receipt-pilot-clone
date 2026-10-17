/**
 * Core domain types for Receipt Pilot-C.
 * All monetary values are stored and calculated as integer minor units (cents)
 * to avoid floating-point errors. Display conversion happens at the UI boundary.
 */

export type CurrencyCode = "NGN" | "USD" | "GBP" | "EUR";

export type PaymentStatus = "UNPAID" | "PARTIAL" | "PAID";

export interface LineItem {
  id: string;
  name: string;
  quantity: number; // can be decimal (e.g. 1.5)
  unitPriceCents: number; // integer
  lineTotalCents: number; // computed
}

export interface BusinessInfo {
  name: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  footer: string;
}

export interface CustomerInfo {
  name: string;
  phone: string;
  email: string;
}

export interface Receipt {
  id: string;
  receiptNumber: string;
  business: BusinessInfo;
  customer: CustomerInfo;
  items: LineItem[];
  discountCents: number;
  taxPercent: number; // e.g. 7.5
  taxCents: number;
  subtotalCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentStatus: PaymentStatus;
  paymentMethod: string;
  currency: CurrencyCode;
  receiptDate: string; // ISO date YYYY-MM-DD
  notes: string;
  templateId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CalculationInput {
  items: Array<{ quantity: number; unitPriceCents: number }>;
  discountCents: number;
  taxPercent: number;
  amountPaidCents: number;
}

export interface CalculationResult {
  subtotalCents: number;
  discountCents: number;
  taxableCents: number;
  taxCents: number;
  totalCents: number;
  amountPaidCents: number;
  balanceDueCents: number;
  paymentStatus: PaymentStatus;
}

/** Product catalogue item. Current stock is kept consistent with StockMovement records. */
export interface Product {
  id: string;
  sku: string;
  name: string;
  category: string;
  sellingPriceCents: number;
  costPriceCents: number;
  stockQty: number;
  lowStockThreshold: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ProductInput {
  sku: string;
  name: string;
  category: string;
  sellingPriceCents: number;
  costPriceCents: number;
  stockQty: number;
  lowStockThreshold: number;
  active: boolean;
}

/** Auditable stock movement. quantityChange is signed (+in / −out). */
export type StockMovementType = "OPENING" | "RESTOCK" | "ADJUSTMENT" | "COUNT";

export interface StockMovement {
  id: string;
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  reason: string;
  createdAt: string;
}

export interface StockMovementInput {
  productId: string;
  type: StockMovementType;
  quantityChange: number;
  reason: string;
}
