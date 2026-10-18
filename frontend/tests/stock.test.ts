import { describe, it, expect } from "vitest";
import {
  applyQuantityChange,
  stockFromMovements,
  validateMovement,
  reconcileCount,
  isConsistent,
  expectedClosing,
} from "../src/stock";
import type { StockMovement, Product } from "../src/types";

function mv(partial: Partial<StockMovement>): StockMovement {
  return {
    id: "m1",
    productId: "p1",
    type: "RESTOCK",
    quantityChange: 5,
    reason: "delivery",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

describe("applyQuantityChange", () => {
  it("adds and subtracts", () => {
    expect(applyQuantityChange(10, 5)).toBe(15);
    expect(applyQuantityChange(10, -3)).toBe(7);
  });

  it("rejects negative result", () => {
    expect(applyQuantityChange(2, -5)).toBeNull();
  });

  it("rejects non-finite", () => {
    expect(applyQuantityChange(NaN, 1)).toBeNull();
    expect(applyQuantityChange(1, Infinity)).toBeNull();
  });
});

describe("stockFromMovements", () => {
  it("sums signed changes", () => {
    const movements = [
      mv({ quantityChange: 10, type: "OPENING" }),
      mv({ quantityChange: 5, type: "RESTOCK" }),
      mv({ quantityChange: -2, type: "ADJUSTMENT" }),
    ];
    expect(stockFromMovements(movements)).toBe(13);
  });
});

describe("validateMovement", () => {
  it("accepts a valid restock", () => {
    expect(validateMovement({ productId: "p1", type: "RESTOCK", quantityChange: 4, reason: "delivery" }, 10)).toEqual([]);
  });

  it("rejects zero change and missing reason", () => {
    const errs = validateMovement({ productId: "p1", type: "ADJUSTMENT", quantityChange: 0, reason: "" }, 10);
    expect(errs.length).toBeGreaterThan(0);
  });

  it("rejects restock with negative quantity", () => {
    expect(validateMovement({ productId: "p1", type: "RESTOCK", quantityChange: -3, reason: "x" }, 10)).toContain("Restock quantity must be positive.");
  });

  it("rejects movement that would go negative", () => {
    expect(validateMovement({ productId: "p1", type: "ADJUSTMENT", quantityChange: -20, reason: "damage" }, 5)).toContain("This movement would make stock negative.");
  });
});

describe("reconcileCount", () => {
  it("computes variance", () => {
    expect(reconcileCount(10, 8).change).toBe(-2);
    expect(reconcileCount(10, 12).change).toBe(2);
    expect(reconcileCount(10, 10).change).toBe(0);
  });

  it("rejects negative count", () => {
    expect(reconcileCount(10, -1).error).toBeTruthy();
  });
});

describe("consistency and expected closing", () => {
  it("matches product stock to movements", () => {
    const product: Product = {
      id: "p1", sku: "A", name: "A", category: "", sellingPriceCents: 100, costPriceCents: 50,
      stockQty: 13, lowStockThreshold: 2, active: true, createdAt: "", updatedAt: "",
    };
    const movements = [
      mv({ productId: "p1", quantityChange: 10, type: "OPENING" }),
      mv({ productId: "p1", quantityChange: 5, type: "RESTOCK" }),
      mv({ productId: "p1", quantityChange: -2, type: "ADJUSTMENT" }),
    ];
    expect(isConsistent(product, movements)).toBe(true);
  });

  it("expected closing formula", () => {
    expect(expectedClosing(10, 5, 2)).toBe(13);
  });
});
