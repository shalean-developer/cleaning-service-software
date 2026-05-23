import { describe, expect, it } from "vitest";
import { composeAdminLocationNotes, composeAdminSpecialInstructions } from "./adminAddressCompose";

describe("admin address compose", () => {
  it("composes location notes from access fields", () => {
    const notes = composeAdminLocationNotes({
      locationNotes: "Unit 4B",
      accessInstructions: "Side gate",
      gateCode: "1234",
      parkingInstructions: "Visitor bay 2",
    });
    expect(notes).toContain("Access: Side gate");
    expect(notes).toContain("Gate/intercom: 1234");
    expect(notes).toContain("Parking: Visitor bay 2");
    expect(notes).toContain("Unit 4B");
  });

  it("composes special instructions with pet notes", () => {
    const notes = composeAdminSpecialInstructions({
      petNotes: "Friendly dog",
      specialInstructions: "Call on arrival",
    });
    expect(notes).toContain("Pets: Friendly dog");
    expect(notes).toContain("Call on arrival");
  });
});
