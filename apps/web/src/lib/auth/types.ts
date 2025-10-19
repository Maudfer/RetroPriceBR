import type { users } from "@retroprice/db/schema";

export type User = typeof users.$inferSelect;

export interface AuthSession {
    sessionId: string;
    userId: string;
    refreshToken: string;
    expiresAt: Date;
}
