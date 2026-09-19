import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  MAX_BASELINE,
  MAX_PRICE,
  parseBaselineInput,
  parsePriceInput,
  termsDiffer,
  toEditableText,
} from "../lib/termsInput";

describe("baseline input", () => {
  test("accepts whole numbers and up to two decimals", () => {
    assert.equal(parseBaselineInput("5"), 5);
    assert.equal(parseBaselineInput(" 12 "), 12);
    assert.equal(parseBaselineInput("0.5"), 0.5);
    assert.equal(parseBaselineInput("2.25"), 2.25);
    assert.equal(parseBaselineInput("1,500"), 1500);
  });

  test("rejects anything that is not a clean amount above zero", () => {
    for (const bad of ["", " ", "0", "0.00", "-5", "abc", "5a", "1.234", ".5", "5.", "1..2", "1e3", "Infinity", "NaN"]) {
      assert.equal(parseBaselineInput(bad), null, `"${bad}" should be rejected`);
    }
  });

  test("has a ceiling so a slipped finger cannot store nonsense", () => {
    assert.equal(parseBaselineInput(String(MAX_BASELINE)), MAX_BASELINE);
    assert.equal(parseBaselineInput(String(MAX_BASELINE + 1)), null);
  });
});

describe("price input", () => {
  test("accepts 0 (a free item) and decimals", () => {
    assert.equal(parsePriceInput("0"), 0);
    assert.equal(parsePriceInput("25"), 25);
    assert.equal(parsePriceInput("12.5"), 12.5);
    assert.equal(parsePriceInput("19.99"), 19.99);
  });

  test("rejects negatives, junk and more than two decimals", () => {
    for (const bad of ["", "-1", "abc", "1.999", ".5", "5.", "1e2"]) {
      assert.equal(parsePriceInput(bad), null, `"${bad}" should be rejected`);
    }
    assert.equal(parsePriceInput(String(MAX_PRICE + 1)), null);
  });
});

describe("editable text and change detection", () => {
  test("stored numbers come back as clean text", () => {
    assert.equal(toEditableText(25), "25");
    assert.equal(toEditableText(12.5), "12.5");
    assert.equal(toEditableText(0.1 + 0.2), "0.3");
    assert.equal(toEditableText(null), "");
    assert.equal(toEditableText(undefined), "");
    assert.equal(toEditableText(Number.NaN), "");
  });

  test("Save only has something to do when a value differs", () => {
    const stored = { baselineQuantity: 4, pricePerItem: 25 };
    assert.equal(termsDiffer(stored, 4, 25), false);
    assert.equal(termsDiffer(stored, 5, 25), true);
    assert.equal(termsDiffer(stored, 4, 30), true);
    assert.equal(termsDiffer({ baselineQuantity: null, pricePerItem: 25 }, 4, 25), true);
  });
});
