import { getEnv } from "@/config/env";

export interface GoogleTokenResponse {
    access_token: string;
    expires_in: number;
    refresh_token?: string;
    scope: string;
    token_type: string;
    id_token: string;
}

export interface GoogleUserProfile {
    sub: string;
    email: string;
    email_verified: boolean;
    name: string;
    picture?: string;
}

export const exchangeCodeForTokens = async (code: string): Promise<GoogleTokenResponse> => {
    const env = getEnv();
    const body = new URLSearchParams({
        code,
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: env.AUTH_REDIRECT_URI,
        grant_type: "authorization_code"
    });

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body
    });

    if (!response.ok) {
        throw new Error(`Failed to exchange auth code for tokens: ${response.status}`);
    }

    return response.json() as Promise<GoogleTokenResponse>;
};

export const fetchGoogleUser = async (accessToken: string): Promise<GoogleUserProfile> => {
    const response = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
        headers: {
            Authorization: `Bearer ${accessToken}`
        },
        cache: "no-store"
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch Google user profile: ${response.status}`);
    }

    return response.json() as Promise<GoogleUserProfile>;
};
