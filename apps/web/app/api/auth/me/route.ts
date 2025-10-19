import { NextRequest, NextResponse } from "next/server";

import { extractBearerToken } from "@/lib/auth/cookies";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/constants";
import { verifyAccessToken } from "@/lib/auth/tokens";
import { getUserById } from "@/lib/auth/users";

const unauthorized = () => NextResponse.json({ error: "unauthorized" }, { status: 401 });

export const GET = async (request: NextRequest) => {
    const headerToken = extractBearerToken(request.headers.get("authorization"));
    const cookieToken = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;
    const token = headerToken ?? cookieToken;

    if (!token) {
        return unauthorized();
    }

    try {
        const payload = await verifyAccessToken(token);
        const user = await getUserById(payload.sub);

        if (!user) {
            return NextResponse.json({ error: "user_not_found" }, { status: 404 });
        }

        return NextResponse.json({
            id: user.id,
            displayName: user.displayName,
            email: user.email,
            reputation: user.reputation,
            isVerifiedStore: user.isVerifiedStore,
            roles: user.roles,
            avatarUrl: user.avatarUrl,
            lastLoginAt: user.lastLoginAt
        });
    } catch {
        return unauthorized();
    }
};
