import { and, eq } from "drizzle-orm";
import type { ExtractTablesWithRelations } from "drizzle-orm";
import type { NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import type { PgTransaction } from "drizzle-orm/pg-core";

import { getDb, schema } from "@/lib/db";

export type DbUser = typeof schema.users.$inferSelect;
export type DbUserRole = typeof schema.userRoles.$inferSelect;
export type UserWithRoles = DbUser & { roles: UserRole[] };
export type UserRole = (typeof schema.userRoleEnum.enumValues)[number];

type DbConnection = ReturnType<typeof getDb>;
type DbExecutor =
    | DbConnection
    | PgTransaction<NodePgQueryResultHKT, typeof schema, ExtractTablesWithRelations<typeof schema>>;

interface GoogleProfile {
    googleId: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
}

const DEFAULT_ROLE: UserRole = "USER";

export const getUserById = async (id: string): Promise<UserWithRoles | null> => {
    const db = getDb();
    const user = await db.query.users.findFirst({
        where: eq(schema.users.id, id)
    });

    if (!user) {
        return null;
    }

    const roles = await getRolesForUser(id);
    return { ...user, roles };
};

export const getUserByGoogleId = async (googleId: string): Promise<UserWithRoles | null> => {
    const db = getDb();
    const user = await db.query.users.findFirst({
        where: eq(schema.users.googleId, googleId)
    });

    if (!user) {
        return null;
    }

    const roles = await getRolesForUser(user.id);
    return { ...user, roles };
};

export const getUserByEmail = async (email: string): Promise<UserWithRoles | null> => {
    const db = getDb();
    const user = await db.query.users.findFirst({
        where: eq(schema.users.email, email)
    });

    if (!user) {
        return null;
    }

    const roles = await getRolesForUser(user.id);
    return { ...user, roles };
};

export const upsertUserFromGoogleProfile = async (profile: GoogleProfile): Promise<UserWithRoles> => {
    const db = getDb();

    return db.transaction(async (tx) => {
        const now = new Date();
        const existingByGoogle = await tx.query.users.findFirst({
            where: eq(schema.users.googleId, profile.googleId)
        });

        if (existingByGoogle) {
            const [updated] = await tx
                .update(schema.users)
                .set({
                    displayName: profile.name,
                    avatarUrl: profile.avatarUrl ?? existingByGoogle.avatarUrl,
                    email: profile.email,
                    lastLoginAt: now,
                    updatedAt: now
                })
                .where(eq(schema.users.id, existingByGoogle.id))
                .returning();

            const roles = await getRolesForUser(existingByGoogle.id, tx);
            return { ...updated, roles };
        }

        const existingByEmail = await tx.query.users.findFirst({
            where: eq(schema.users.email, profile.email)
        });

        if (existingByEmail) {
            const [updated] = await tx
                .update(schema.users)
                .set({
                    googleId: profile.googleId,
                    displayName: profile.name,
                    avatarUrl: profile.avatarUrl ?? existingByEmail.avatarUrl,
                    lastLoginAt: now,
                    updatedAt: now
                })
                .where(eq(schema.users.id, existingByEmail.id))
                .returning();

            const roles = await ensureDefaultRole(existingByEmail.id, tx);
            return { ...updated, roles };
        }

        const [inserted] = await tx
            .insert(schema.users)
            .values({
                googleId: profile.googleId,
                displayName: profile.name,
                email: profile.email,
                avatarUrl: profile.avatarUrl ?? null,
                lastLoginAt: now
            })
            .returning();

        const roles = await ensureDefaultRole(inserted.id, tx);
        return { ...inserted, roles };
    });
};

const selectRoles = async (executor: DbExecutor, userId: string) => {
    return executor
        .select({ role: schema.userRoles.role })
        .from(schema.userRoles)
        .where(eq(schema.userRoles.userId, userId));
};

export const getRolesForUser = async (userId: string, executor?: DbExecutor): Promise<UserRole[]> => {
    const rows = await selectRoles(executor ?? getDb(), userId);
    return rows.map((row) => row.role as UserRole);
};

const ensureDefaultRole = async (userId: string, executor: DbExecutor): Promise<UserRole[]> => {
    const roles = await selectRoles(executor, userId);
    const hasDefault = roles.some((row) => row.role === DEFAULT_ROLE);

    if (!hasDefault) {
        await executor.insert(schema.userRoles).values({ userId, role: DEFAULT_ROLE });
    }

    const refreshed = await selectRoles(executor, userId);
    return refreshed.map((row) => row.role as UserRole);
};

export const assignRole = async (userId: string, role: UserRole) => {
    const db = getDb();
    await db
        .insert(schema.userRoles)
        .values({ userId, role })
        .onConflictDoNothing({
            target: [schema.userRoles.userId, schema.userRoles.role]
        });
};

export const removeRole = async (userId: string, role: UserRole) => {
    const db = getDb();
    await db
        .delete(schema.userRoles)
        .where(and(eq(schema.userRoles.userId, userId), eq(schema.userRoles.role, role)));
};
