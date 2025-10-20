import { NextRequest, NextResponse } from "next/server";

import { getEnv } from "../../../../src/config/env";
import { ACCESS_TOKEN_COOKIE } from "../../../../src/lib/auth/constants";
import { parseRefreshCookie } from "../../../../src/lib/auth/cookies";
import { revokeSession } from "../../../../src/lib/auth/sessions";

export const POST = async (request: NextRequest) => {
    const env = getEnv();
    const raw = request.cookies.get(env.REFRESH_TOKEN_COOKIE_NAME)?.value;
    const parsed = parseRefreshCookie(raw);

    if (parsed) {
        await revokeSession(parsed.sessionId);
    }

    const response = new NextResponse(null, { status: 204 });

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
