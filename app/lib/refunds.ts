// Refund Eligibility and Refund Amount — see GLOSSARY.md. These are the only
// rules for whether a Learner may request a Refund; the course page and the
// refund route both go through them.

export const REFUND_WINDOW_DAYS = 14;
export const REFUND_WATCH_LIMIT_SECONDS = 2 * 60 * 60;
export const REFUND_COMPLETION_LIMIT = 0.5;

export type RefundIneligibleReason =
  | "no-purchase"
  | "already-has-refund"
  | "window-closed"
  | "completed-too-much"
  | "watched-too-much"
  | "claimed-team-seat";

export type RefundEligibility =
  | {
      eligible: true;
      purchaseId: number;
      refundAmount: number;
      lastDayOfRefundWindow: string;
    }
  | { eligible: false; reason: RefundIneligibleReason };

export type RefundFacts = {
  purchase: { id: number; amountPaid: number; createdAt: string } | null;
  hasRefund: boolean;
  isClaimedTeamSeat: boolean;
  lessonCount: number;
  completedLessonCount: number;
  watchedSeconds: number;
};

export const REFUND_INELIGIBLE_MESSAGES: Record<
  RefundIneligibleReason,
  string
> = {
  "no-purchase": "You have not bought this course.",
  "already-has-refund": "You have already requested a refund for this purchase.",
  "window-closed": `The ${REFUND_WINDOW_DAYS}-day Refund Window has closed.`,
  "completed-too-much":
    "You have completed too much of this course to request a refund.",
  "watched-too-much":
    "You have watched too much of this course to request a refund.",
  "claimed-team-seat": "A claimed team seat cannot be refunded.",
};

// The Refund Window is counted in whole calendar days, not hours — someone
// who buys at 23:00 still gets the whole of their fourteenth day.
export function calendarDay(when: Date): string {
  const month = String(when.getMonth() + 1).padStart(2, "0");
  const day = String(when.getDate()).padStart(2, "0");
  return `${when.getFullYear()}-${month}-${day}`;
}

export function lastDayOfRefundWindow(purchasedAtIso: string): string {
  const deadline = new Date(purchasedAtIso);
  deadline.setDate(deadline.getDate() + REFUND_WINDOW_DAYS);
  return calendarDay(deadline);
}

export function decideRefundEligibility(
  facts: RefundFacts,
  now: Date = new Date()
): RefundEligibility {
  const { purchase } = facts;

  if (!purchase) return { eligible: false, reason: "no-purchase" };
  if (facts.hasRefund) return { eligible: false, reason: "already-has-refund" };

  const today = calendarDay(now);
  const lastDay = lastDayOfRefundWindow(purchase.createdAt);
  const purchasedDay = calendarDay(new Date(purchase.createdAt));
  if (today < purchasedDay || today > lastDay) {
    return { eligible: false, reason: "window-closed" };
  }

  if (
    facts.lessonCount > 0 &&
    facts.completedLessonCount / facts.lessonCount >= REFUND_COMPLETION_LIMIT
  ) {
    return { eligible: false, reason: "completed-too-much" };
  }

  if (facts.watchedSeconds >= REFUND_WATCH_LIMIT_SECONDS) {
    return { eligible: false, reason: "watched-too-much" };
  }

  if (facts.isClaimedTeamSeat) {
    return { eligible: false, reason: "claimed-team-seat" };
  }

  return {
    eligible: true,
    purchaseId: purchase.id,
    // The Refund Amount is what the Learner paid, whatever the price is today.
    refundAmount: purchase.amountPaid,
    lastDayOfRefundWindow: lastDay,
  };
}
