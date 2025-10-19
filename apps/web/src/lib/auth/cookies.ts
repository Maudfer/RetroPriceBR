export interface RefreshCookiePayload {
    sessionId: string;
    token: string;
}

export const serializeRefreshCookie = (sessionId: string, token: string): string => {
    return `${sessionId}:${token}`;
};

export const parseRefreshCookie = (raw: string | undefined): RefreshCookiePayload | null => {
    if (!raw) {
        return null;
    }

    const [sessionId, token] = raw.split(":");
    if (!sessionId || !token) {
        return null;
    }

    return { sessionId, token };
};

export const extractBearerToken = (header: string | null): string | null => {
    if (!header) {
        return null;
    }

    const [scheme, value] = header.split(" ");
    if (!scheme || !value) {
        return null;
    }

    return scheme.toLowerCase() === "bearer" ? value : null;
};
