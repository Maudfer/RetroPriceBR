import { NextResponse } from "next/server";

import { getEnv } from "@/config/env";
import { createOAuthState } from "@/lib/auth/oauth";
import { OAUTH_SCOPE, OAUTH_STATE_COOKIE } from "@/lib/auth/constants";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const STATE_TTL_SECONDS = 5 * 60;

export const GET = async () => {
    const env = getEnv();
    const { state, cookieValue } = createOAuthState();

    const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: env.AUTH_REDIRECT_URI,
        response_type: "code",
        scope: OAUTH_SCOPE,
        access_type: "offline",
        prompt: "consent",
        state
    });

    const authorizationUrl = `${GOOGLE_AUTH_URL}?${params.toString()}`;
    const response = NextResponse.redirect(authorizationUrl);

    response.cookies.set({
        name: OAUTH_STATE_COOKIE,
        value: cookieValue,
        httpOnly: true,
        maxAge: STATE_TTL_SECONDS,
        path: "/",
        sameSite: "lax",
        secure: env.NODE_ENV === "production"
    });

    return response;
};
