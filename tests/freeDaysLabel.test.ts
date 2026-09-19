import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { formatFreeDays, getQuitCopy } from "../lib/templates";

describe("clean-days wording follows the habit", () => {
  test("each quit habit names its own clean days", () => {
    assert.equal(formatFreeDays(0, "smoking"), "0 smoke-free days");
    assert.equal(formatFreeDays(3, "panmasala"), "3 chew-free days");
    assert.equal(formatFreeDays(0, "panmasala"), "0 chew-free days", "chewing must never say smoke-free");
    assert.equal(formatFreeDays(2, "alcohol"), "2 sober days");
  });

  test("exactly one day is singular", () => {
    assert.equal(formatFreeDays(1, "smoking"), "1 smoke-free day");
    assert.equal(formatFreeDays(1, "panmasala"), "1 chew-free day");
  });

  test("a custom or unknown habit falls back to the default wording", () => {
    assert.equal(formatFreeDays(4, "custom-quit"), `4 ${getQuitCopy("custom-quit").daysLabel}`);
    assert.equal(formatFreeDays(4, null), `4 ${getQuitCopy(null).daysLabel}`);
    assert.equal(formatFreeDays(4, undefined), `4 ${getQuitCopy().daysLabel}`);
  });

  test("no habit's label uses the wrong substance", () => {
    const chew = getQuitCopy("panmasala").daysLabel;
    assert.ok(!/smoke/i.test(chew), chew);
  });
});
