import { describe, it, expect } from "vitest";
import { validateProduct, countLowStock, isLowStock, normalizeSku, productInputFromForm } from "../src/products";
import type { Product } from "../src/types";

function makeProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: "p1",
    sku: "SKU1",
    name: "Item",
    category: "General",
    sellingPriceCents: 1000,
    costPriceCents: 500,
    stockQty: 10,
    lowStockThreshold: 5,
    active: true,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("validateProduct", () => {
  const valid = {
    sku: "ABC",
    name: "Widget",
    category: "Tools",
    sellingPriceCents: 1500,
    costPriceCents: 800,
    stockQty: 4,
    lowStockThreshold: 2,
    active: true,
  };

  it("accepts a valid product", () => {
    expect(validateProduct(valid)).toEqual([]);
  });

  it("requires a name", () => {
    expect(validateProduct({ ...valid, name: "  " })).toContain("Product name is required.");
  });

  it("rejects negative prices and stock", () => {
    const errs = validateProduct({
      ...valid,
      sellingPriceCents: -1,
      costPriceCents: -5,
      stockQty: -1,
      lowStockThreshold: -1,
    });
    expect(errs).toContain("Selling price cannot be negative.");
    expect(errs).toContain("Cost price cannot be negative.");
    expect(errs).toContain("Stock quantity cannot be negative.");
    expect(errs).toContain("Low-stock threshold cannot be negative.");
  });

  it("rejects duplicate SKU", () => {
    expect(validateProduct(valid, ["ABC"])).toContain("A product with this SKU already exists.");
  });

  it("allows same SKU when it is the current product", () => {
    // caller excludes current product's SKU from the list
    expect(validateProduct(valid, [])).toEqual([]);
  });
});

describe("low stock", () => {
  it("counts active products at or below threshold", () => {
    const products = [
      makeProduct({ id: "a", stockQty: 2, lowStockThreshold: 5 }),
      makeProduct({ id: "b", stockQty: 10, lowStockThreshold: 5 }),
      makeProduct({ id: "c", stockQty: 0, lowStockThreshold: 1, active: false }),
    ];
    expect(countLowStock(products)).toBe(1);
    expect(isLowStock(products[0])).toBe(true);
    expect(isLowStock(products[2])).toBe(false);
  });
});

describe("productInputFromForm", () => {
  it("parses money and quantities", () => {
    const input = productInputFromForm({
      sku: " x1 ",
      name: "  Nail  ",
      category: "Hardware",
      sellingPrice: "12.50",
      costPrice: "7.00",
      stockQty: "3",
      lowStockThreshold: "1",
      active: true,
    });
    expect(input.sku).toBe("x1");
    expect(input.name).toBe("Nail");
    expect(input.sellingPriceCents).toBe(1250);
    expect(input.costPriceCents).toBe(700);
    expect(input.stockQty).toBe(3);
  });
});

describe("normalizeSku", () => {
  it("trims and uppercases", () => {
    expect(normalizeSku("  ab-12  ")).toBe("AB-12");
  });
});
