import { describe, expect, it } from "vitest";
import {
  initialContactPhoneField,
  resolveContactPhoneForMetadata,
  resolveWizardContactPhone,
} from "./contactPhone";
import { filledState } from "./testFixtures";

describe("resolveWizardContactPhone", () => {
  it("prefers entered phone over profile", () => {
    expect(resolveWizardContactPhone("083 111 2222", "+27821234567")).toBe(
      "+27831112222",
    );
  });

  it("falls back to profile when field is empty", () => {
    expect(resolveWizardContactPhone("", "+27821234567")).toBe("+27821234567");
  });
});

describe("initialContactPhoneField", () => {
  it("uses stored value when present", () => {
    expect(initialContactPhoneField("083 999 8888", "+27821234567")).toBe("083 999 8888");
  });

  it("pre-fills from profile when stored is empty", () => {
    expect(initialContactPhoneField("", "+27821234567")).toBe("082 123 4567");
  });
});

describe("resolveContactPhoneForMetadata", () => {
  it("includes E.164 in metadata build input", () => {
    expect(
      resolveContactPhoneForMetadata(
        filledState({ contactPhone: "082 555 1234", profilePhone: null }),
      ),
    ).toBe("+27825551234");
  });
});
