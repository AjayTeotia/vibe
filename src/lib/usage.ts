import { RateLimiterPrisma } from "rate-limiter-flexible"
import prisma from "./db"
import { auth } from "@clerk/nextjs/server";

const FREE_POINTS = 5;
const PRO_POINTS = 100
const DURATION = 30 * 24 * 60 * 60; // 30 days
const GENERAL_POINTS = 1;

export async function getUsageTracker() {
    const { has } = await auth();
    const hasProAccess = has({ plan: "pro" });

    const usageTracker = new RateLimiterPrisma({
        storeClient: prisma,
        tableName: "usage",
        points: hasProAccess ? PRO_POINTS : FREE_POINTS,
        duration: DURATION
    })

    return usageTracker
}

export async function consumeCredits() {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("User not authenticated");
    }

    const userTracker = await getUsageTracker();
    const result = await userTracker.consume(userId, GENERAL_POINTS);

    return result
}

export async function getUsageStatus() {
    const { userId } = await auth();
    if (!userId) {
        throw new Error("User not authenticated");
    }

    const userTracker = await getUsageTracker();
    const result = await userTracker.get(userId);

    return result
}