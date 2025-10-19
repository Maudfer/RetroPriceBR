import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { parseRefreshCookie, serializeRefreshCookie } from "@/lib/auth/cookies";
import { generateRefreshToken, rotateSession, verifySession } from "@/lib/auth/sessions";
import { issueAccessToken } from "@/lib/auth/tokens";
import { getUserById } from "@/lib/auth/users";

const unauthorizedResponse = (env: ReturnType<typeof getEnv>) => {
    const response = NextResponse.json({ error: "unauthorized" }, { status: 401 });
    response.cookies.set({
        name: env.REFRESH_TOKEN_COOKIE_NAME,
        value: "",
        maxAge: 0,
        path: "/"
    });
    response.cookies.set({
        name: ACCESS_TOKEN_COOKIE,
        value: "",
        maxAge: 0,
        path: "/"
    });
    return response;
};

export const POST = async (request: NextRequest) => {
    const env = getEnv();
    const cookieValue = request.cookies.get(env.REFRESH_TOKEN_COOKIE_NAME)?.value;
    const parsed = parseRefreshCookie(cookieValue);

    if (!parsed) {
        return unauthorizedResponse(env);
    }

    const session = await verifySession(parsed.sessionId, parsed.token);
    if (!session) {
        return unauthorizedResponse(env);
    }

    const user = await getUserById(session.userId);
    if (!user) {
        return unauthorizedResponse(env);
    }

    const nextRefresh = generateRefreshToken();
    const updatedSession = await rotateSession(session.id, parsed.token, nextRefresh, {
        userAgent: request.headers.get("user-agent") ?? undefined,
        ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
            request.headers.get("x-real-ip") ?? undefined
    });

    if (!updatedSession) {
        return unauthorizedResponse(env);
    }

    const accessToken = await issueAccessToken({
        sub: user.id,
        email: user.email,
        name: user.displayName,
        reputation: user.reputation,
        roles: user.roles,
        isVerifiedStore: user.isVerifiedStore
    });

    const response = NextResponse.json({ accessToken });

    response.cookies.set({
        name: env.REFRESH_TOKEN_COOKIE_NAME,
        value: serializeRefreshCookie(updatedSession.id, nextRefresh),
        httpOnly: true,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: env.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60,
        domain: env.REFRESH_TOKEN_COOKIE_DOMAIN
    });

    response.cookies.set({
        name: ACCESS_TOKEN_COOKIE,
        value: accessToken,
        httpOnly: false,
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        path: "/",
        maxAge: env.ACCESS_TOKEN_TTL_MINUTES * 60
    });

    return response;
};
