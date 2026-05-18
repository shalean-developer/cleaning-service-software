import { describe, expect, it } from "vitest";
import {
  cleanerJobStatusHero,
  cleanerJobWhatHappensNext,
} from "./cleanerJobDetailDisplay";

describe("cleanerJobDetailDisplay", () => {
  it("returns calm hero copy for assigned jobs", () => {
    const hero = cleanerJobStatusHero("assigned");
    expect(hero.description).toContain("scheduled");
    expect(hero.expectedUpdate).toContain("Start");
  });

  it("returns what happens next for in-progress jobs", () => {
    const next = cleanerJobWhatHappensNext("in_progress");
    expect(next?.title).toBe("What happens next");
    expect(next?.steps.some((s) => s.title === "Mark complete")).toBe(true);
  });

  it("hides next steps for unknown pre-job states", () => {
    expect(cleanerJobWhatHappensNext("pending_payment")).toBeNull();
  });
});
