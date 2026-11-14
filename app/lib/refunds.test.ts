import { describe, it, expect } from "vitest";
import { decideRefundEligibility, type RefundFacts } from "./refunds";

const NOW = new Date(2026, 10, 14, 12, 0, 0);

function daysBefore(days: number, hour = 12): string {
  return new Date(2026, 10, 14 - days, hour, 0, 0).toISOString();
}

function facts(overrides: Partial<RefundFacts> = {}): RefundFacts {
  return {
    purchase: { id: 1, amountPaid: 4999, createdAt: daysBefore(3) },
    hasRefund: false,
    isClaimedTeamSeat: false,
    lessonCount: 10,
    completedLessonCount: 0,
    watchedSeconds: 0,
    ...overrides,
  };
}

function reasonFor(overrides: Partial<RefundFacts>) {
  const result = decideRefundEligibility(facts(overrides), NOW);
  return result.eligible ? "eligible" : result.reason;
}

describe("decideRefundEligibility", () => {
  it("offers the amount paid as the Refund Amount", () => {
    const result = decideRefundEligibility(facts(), NOW);
    expect(result).toEqual({
      eligible: true,
      purchaseId: 1,
      refundAmount: 4999,
      lastDayOfRefundWindow: "2026-11-25",
    });
  });

  it("needs a Purchase", () => {
    expect(reasonFor({ purchase: null })).toBe("no-purchase");
  });

  it("allows only one Refund per Purchase, whatever its status", () => {
    expect(reasonFor({ hasRefund: true })).toBe("already-has-refund");
  });

  describe("Refund Window", () => {
    it("is open on the whole fourteenth day", () => {
      expect(reasonFor({ purchase: { id: 1, amountPaid: 1, createdAt: daysBefore(14, 23) } })).toBe(
        "eligible"
      );
    });

    it("is closed on the fifteenth day", () => {
      expect(reasonFor({ purchase: { id: 1, amountPaid: 1, createdAt: daysBefore(15, 1) } })).toBe(
        "window-closed"
      );
    });
  });

  it("is closed once half the lessons are completed", () => {
    expect(reasonFor({ completedLessonCount: 4 })).toBe("eligible");
    expect(reasonFor({ completedLessonCount: 5 })).toBe("completed-too-much");
  });

  it("is closed once two hours are watched", () => {
    expect(reasonFor({ watchedSeconds: 2 * 60 * 60 - 1 })).toBe("eligible");
    expect(reasonFor({ watchedSeconds: 2 * 60 * 60 })).toBe("watched-too-much");
  });

  it("is closed for a claimed team seat", () => {
    expect(reasonFor({ isClaimedTeamSeat: true })).toBe("claimed-team-seat");
  });
});
