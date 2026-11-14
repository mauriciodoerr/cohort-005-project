import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { db } from "~/db";
import {
  coupons,
  lessonProgress,
  LessonProgressStatus,
  lessons,
  modules,
  purchases,
  refunds,
  videoWatchEvents,
} from "~/db/schema";
import { decideRefundEligibility, type RefundEligibility } from "~/lib/refunds";

function getLatestPurchase(userId: number, courseId: number) {
  return db
    .select()
    .from(purchases)
    .where(and(eq(purchases.userId, userId), eq(purchases.courseId, courseId)))
    .orderBy(sql`${purchases.createdAt} desc`)
    .get();
}

function getLessonIdsForCourse(courseId: number): number[] {
  return db
    .select({ id: lessons.id })
    .from(lessons)
    .innerJoin(modules, eq(lessons.moduleId, modules.id))
    .where(eq(modules.courseId, courseId))
    .all()
    .map((row) => row.id);
}

function hasAnyRefund(purchaseId: number): boolean {
  return (
    db
      .select({ id: refunds.id })
      .from(refunds)
      .where(eq(refunds.purchaseId, purchaseId))
      .get() !== undefined
  );
}

function isClaimedTeamSeat(purchaseId: number): boolean {
  return (
    db
      .select({ id: coupons.id })
      .from(coupons)
      .where(
        and(eq(coupons.purchaseId, purchaseId), isNotNull(coupons.redeemedAt))
      )
      .get() !== undefined
  );
}

function getCompletedLessonCount(userId: number, lessonIds: number[]): number {
  if (lessonIds.length === 0) return 0;

  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(lessonProgress)
    .where(
      and(
        eq(lessonProgress.userId, userId),
        eq(lessonProgress.status, LessonProgressStatus.Completed),
        inArray(lessonProgress.lessonId, lessonIds)
      )
    )
    .get();

  return result?.count ?? 0;
}

// Watched time is the furthest point reached in each lesson, summed.
function getWatchedSeconds(userId: number, lessonIds: number[]): number {
  if (lessonIds.length === 0) return 0;

  return db
    .select({
      furthest: sql<number>`max(${videoWatchEvents.positionSeconds})`,
    })
    .from(videoWatchEvents)
    .where(
      and(
        eq(videoWatchEvents.userId, userId),
        inArray(videoWatchEvents.lessonId, lessonIds)
      )
    )
    .groupBy(videoWatchEvents.lessonId)
    .all()
    .reduce((total, row) => total + row.furthest, 0);
}

export function getRefundEligibility(
  userId: number,
  courseId: number
): RefundEligibility {
  const purchase = getLatestPurchase(userId, courseId) ?? null;

  if (!purchase) {
    return decideRefundEligibility({
      purchase: null,
      hasRefund: false,
      isClaimedTeamSeat: false,
      lessonCount: 0,
      completedLessonCount: 0,
      watchedSeconds: 0,
    });
  }

  const lessonIds = getLessonIdsForCourse(courseId);

  return decideRefundEligibility({
    purchase,
    hasRefund: hasAnyRefund(purchase.id),
    isClaimedTeamSeat: isClaimedTeamSeat(purchase.id),
    lessonCount: lessonIds.length,
    completedLessonCount: getCompletedLessonCount(userId, lessonIds),
    watchedSeconds: getWatchedSeconds(userId, lessonIds),
  });
}
