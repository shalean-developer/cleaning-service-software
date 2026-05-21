import { describe, expect, it } from "vitest";
import { isRecurringNotificationsEnabled } from "./recurringNotificationConfig";

describe("isRecurringNotificationsEnabled", () => {
  it("defaults to false when unset", () => {
    const prev = process.env.ENABLE_RECURRING_NOTIFICATIONS;
    delete process.env.ENABLE_RECURRING_NOTIFICATIONS;
    expect(isRecurringNotificationsEnabled()).toBe(false);
    if (prev !== undefined) process.env.ENABLE_RECURRING_NOTIFICATIONS = prev;
  });

  it("is true only when explicitly enabled", () => {
    process.env.ENABLE_RECURRING_NOTIFICATIONS = "true";
    expect(isRecurringNotificationsEnabled()).toBe(true);
    delete process.env.ENABLE_RECURRING_NOTIFICATIONS;
  });
});
