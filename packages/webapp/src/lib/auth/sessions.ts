import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { and, eq, gt, isNull } from "drizzle-orm";

import { getDb, schema } from "../db";
import { getEnv } from "../../config/env";

const REFRESH_TOKEN_BYTES = 48;

export interface SessionMetadata {
    userAgent?: string;
    ipAddress?: string;
}

export type UserSession = typeof schema.userSessions.$inferSelect;

export const generateRefreshToken = (): string => {
    return randomBytes(REFRESH_TOKEN_BYTES).toString("hex");
};

export const hashRefreshToken = (token: string): string => {
    const env = getEnv();
    return createHash("sha256").update(`${token}.${env.REFRESH_TOKEN_SECRET}`).digest("hex");
};

const computeExpiry = (): Date => {
    const env = getEnv();
    return new Date(Date.now() + env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);
};

export const createSession = async (userId: string, token: string, metadata: SessionMetadata = {}) => {
    const db = getDb();
    const hashed = hashRefreshToken(token);
    const [session] = await db
        .insert(schema.userSessions)
        .values({
            userId,
            refreshTokenHash: hashed,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
            expiresAt: computeExpiry()
        })
        .returning();

    return session;
};

export const rotateSession = async (
    sessionId: string,
    currentToken: string,
    nextToken: string,
    metadata: SessionMetadata = {}
): Promise<UserSession | null> => {
    const db = getDb();
    const currentHash = hashRefreshToken(currentToken);
    const nextHash = hashRefreshToken(nextToken);

    const [updated] = await db
        .update(schema.userSessions)
        .set({
            refreshTokenHash: nextHash,
            userAgent: metadata.userAgent,
            ipAddress: metadata.ipAddress,
            expiresAt: computeExpiry()
        })
        .where(and(eq(schema.userSessions.id, sessionId), eq(schema.userSessions.refreshTokenHash, currentHash)))
        .returning();

    return updated ?? null;
};

export const revokeSession = async (sessionId: string): Promise<boolean> => {
    const db = getDb();
    const updated = await db
        .update(schema.userSessions)
        .set({ revokedAt: new Date() })
        .where(eq(schema.userSessions.id, sessionId))
        .returning({ id: schema.userSessions.id });

    return updated.length > 0;
};

export const verifySession = async (sessionId: string, token: string): Promise<UserSession | null> => {
    const db = getDb();
    const hashed = hashRefreshToken(token);
    const [session] = await db
        .select()
        .from(schema.userSessions)
        .where(
            and(
                eq(schema.userSessions.id, sessionId),
                eq(schema.userSessions.refreshTokenHash, hashed),
                isNull(schema.userSessions.revokedAt),
                gt(schema.userSessions.expiresAt, new Date())
            )
        )
        .limit(1);

    if (!session) {
        return null;
    }

    const matches = timingSafeEqual(Buffer.from(session.refreshTokenHash, "hex"), Buffer.from(hashed, "hex"));
    return matches ? session : null;
};
