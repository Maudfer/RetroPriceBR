import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { ACCESS_TOKEN_COOKIE, OAUTH_STATE_COOKIE } from "@/lib/auth/constants";
import { exchangeCodeForTokens, fetchGoogleUser } from "@/lib/auth/google";
import { verifyOAuthState } from "@/lib/auth/oauth";
import { issueAccessToken } from "@/lib/auth/tokens";
import { generateRefreshToken, createSession } from "@/lib/auth/sessions";
import { upsertUserFromGoogleProfile } from "@/lib/auth/users";
import { serializeRefreshCookie } from "@/lib/auth/cookies";

const buildRedirectUrl = (request: NextRequest, target: string): URL => {
    try {
        return new URL(target, request.url);
    } catch {
        return new URL("/", request.url);
    }
};

const buildErrorRedirect = (request: NextRequest, target: string, reason: string): URL => {
    const url = buildRedirectUrl(request, target);
    url.searchParams.set("reason", reason);
    return url;
};

export const GET = async (request: NextRequest) => {
    const url = request.nextUrl;
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const oauthError = url.searchParams.get("error");
    const storedState = request.cookies.get(OAUTH_STATE_COOKIE)?.value;

    const env = getEnv();

    if (oauthError) {
        return NextResponse.redirect(buildErrorRedirect(request, env.AUTH_ERROR_REDIRECT, oauthError));
    }

    if (!code || !verifyOAuthState(stateParam, storedState)) {
        return NextResponse.redirect(buildErrorRedirect(request, env.AUTH_ERROR_REDIRECT, "invalid_state"));
    }

    try {
        const tokenResponse = await exchangeCodeForTokens(code);
        const profile = await fetchGoogleUser(tokenResponse.access_token);

        if (!profile.email_verified) {
            return NextResponse.redirect(buildErrorRedirect(request, env.AUTH_ERROR_REDIRECT, "email_not_verified"));
        }

        const user = await upsertUserFromGoogleProfile({
            googleId: profile.sub,
            email: profile.email,
            name: profile.name,
            avatarUrl: profile.picture
        });

        const refreshToken = generateRefreshToken();
        const session = await createSession(
            user.id,
            refreshToken,
            {
                userAgent: request.headers.get("user-agent") ?? undefined,
                ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
                    request.headers.get("x-real-ip") ?? undefined
            }
        );

        const accessToken = await issueAccessToken({
            sub: user.id,
            email: user.email,
            name: user.displayName,
            reputation: user.reputation,
            roles: user.roles,
            isVerifiedStore: user.isVerifiedStore
        });

        const response = NextResponse.redirect(buildRedirectUrl(request, env.AUTH_SUCCESS_REDIRECT));

        response.cookies.set({
            name: env.REFRESH_TOKEN_COOKIE_NAME,
            value: serializeRefreshCookie(session.id, refreshToken),
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

        response.cookies.set({
            name: OAUTH_STATE_COOKIE,
            value: "",
            maxAge: 0,
            path: "/"
        });

        return response;
    } catch (error) {
        console.error("OAuth callback error", error);
        return NextResponse.redirect(buildErrorRedirect(request, env.AUTH_ERROR_REDIRECT, "server_error"));
    }
};
