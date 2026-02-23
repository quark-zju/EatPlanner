import { describe, expect, it } from "vitest";
import { formatQuantityWithUnit } from "./format";

describe("formatQuantityWithUnit", () => {
  it("uses multiplication sign when unit starts with a number", () => {
    expect(formatQuantityWithUnit(2, "85g")).toBe("2 × 85g");
  });

  it("uses a space separator for non-numeric units", () => {
    expect(formatQuantityWithUnit(2, "patty")).toBe("2 patty");
  });
});
