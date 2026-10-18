import { describe, it, expect } from "vitest";
import {
  calculateReceipt,
  lineTotalCents,
  parseMoneyToCents,
  formatMoney,
  validateCalculationInput,
} from "../src/calculations";

describe("lineTotalCents", () => {
  it("computes simple line total", () => {
    expect(lineTotalCents(2, 1500)).toBe(3000); // 2 × $15.00
  });

  it("rounds half-up for fractional quantities", () => {
    expect(lineTotalCents(1.5, 100)).toBe(150); // 1.5 × $1.00
    expect(lineTotalCents(0.333, 1000)).toBe(333); // rounds to nearest
  });

  it("returns 0 for invalid inputs", () => {
    expect(lineTotalCents(-1, 100)).toBe(0);
    expect(lineTotalCents(1, -50)).toBe(0);
    expect(lineTotalCents(NaN, 100)).toBe(0);
  });
});

describe("calculateReceipt", () => {
  it("computes subtotal, discount, tax, total correctly", () => {
    const result = calculateReceipt({
      items: [
        { quantity: 2, unitPriceCents: 1000 }, // 2000
        { quantity: 1, unitPriceCents: 500 },  // 500
      ],
      discountCents: 200,
      taxPercent: 10,
      amountPaidCents: 0,
    });
    expect(result.subtotalCents).toBe(2500);
    expect(result.discountCents).toBe(200);
    expect(result.taxableCents).toBe(2300);
    expect(result.taxCents).toBe(230); // 10% of 2300
    expect(result.totalCents).toBe(2530);
    expect(result.balanceDueCents).toBe(2530);
    expect(result.paymentStatus).toBe("UNPAID");
  });

  it("caps discount at subtotal", () => {
    const result = calculateReceipt({
      items: [{ quantity: 1, unitPriceCents: 1000 }],
      discountCents: 2000,
      taxPercent: 0,
      amountPaidCents: 0,
    });
    expect(result.discountCents).toBe(1000);
    expect(result.totalCents).toBe(0);
  });

  it("handles partial and full payment status", () => {
    const base = {
      items: [{ quantity: 1, unitPriceCents: 10000 }],
      discountCents: 0,
      taxPercent: 0,
      amountPaidCents: 4000,
    };
    expect(calculateReceipt(base).paymentStatus).toBe("PARTIAL");
    expect(calculateReceipt({ ...base, amountPaidCents: 10000 }).paymentStatus).toBe("PAID");
    expect(calculateReceipt({ ...base, amountPaidCents: 12000 }).paymentStatus).toBe("PAID");
  });

  it("handles zero total as paid", () => {
    const result = calculateReceipt({
      items: [],
      discountCents: 0,
      taxPercent: 0,
      amountPaidCents: 0,
    });
    expect(result.totalCents).toBe(0);
    expect(result.paymentStatus).toBe("PAID");
  });

  it("avoids floating-point drift on common tax rates", () => {
    // 7.5% of 1000 cents = 75 exactly
    const result = calculateReceipt({
      items: [{ quantity: 1, unitPriceCents: 1000 }],
      discountCents: 0,
      taxPercent: 7.5,
      amountPaidCents: 0,
    });
    expect(result.taxCents).toBe(75);
    expect(result.totalCents).toBe(1075);
  });
});

describe("parseMoneyToCents", () => {
  it("parses decimals correctly", () => {
    expect(parseMoneyToCents("10.50")).toBe(1050);
    expect(parseMoneyToCents("0.01")).toBe(1);
    expect(parseMoneyToCents("1000")).toBe(100000);
    expect(parseMoneyToCents("1,234.56")).toBe(123456);
  });

  it("rejects negative and invalid", () => {
    expect(parseMoneyToCents("-5")).toBe(0);
    expect(parseMoneyToCents("abc")).toBe(0);
    expect(parseMoneyToCents("")).toBe(0);
  });
});

describe("formatMoney", () => {
  it("formats with currency", () => {
    expect(formatMoney(12345, "NGN")).toBe("NGN 123.45");
    expect(formatMoney(-50, "USD")).toBe("-USD 0.50");
  });
});

describe("validateCalculationInput", () => {
  it("flags missing items and bad quantities", () => {
    const errs = validateCalculationInput({
      items: [{ quantity: 0, unitPriceCents: 100 }],
      discountCents: 0,
      taxPercent: 0,
      amountPaidCents: 0,
    });
    expect(errs.length).toBeGreaterThan(0);
  });

  it("accepts valid input", () => {
    const errs = validateCalculationInput({
      items: [{ quantity: 1, unitPriceCents: 100 }],
      discountCents: 0,
      taxPercent: 5,
      amountPaidCents: 50,
    });
    expect(errs).toEqual([]);
  });
});
