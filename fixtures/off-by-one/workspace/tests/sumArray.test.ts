import { describe, expect, it } from "vitest";
import { sumArray } from "../src/sumArray";

describe("sumArray", () => {
  it("returns 0 for an empty array", () => {
    expect(sumArray([])).toBe(0);
  });

  it("sums positive integers", () => {
    expect(sumArray([1, 2, 3, 4])).toBe(10);
  });

  it("sums mixed values", () => {
    expect(sumArray([10, -3, 7])).toBe(14);
  });
});
