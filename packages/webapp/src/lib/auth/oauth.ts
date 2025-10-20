import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getEnv } from "../../config/env";

const STATE_BYTES = 24;

export interface OAuthStatePair {
    state: string;
    cookieValue: string;
}

export const createOAuthState = (): OAuthStatePair => {
    const env = getEnv();
    const state = randomBytes(STATE_BYTES).toString("hex");
    const signature = createHmac("sha256", env.CSRF_SECRET).update(state).digest("hex");
    return {
        state,
        cookieValue: `${state}.${signature}`
    };
};

export const verifyOAuthState = (stateParam: string | null, cookieValue: string | undefined): boolean => {
    if (!stateParam || !cookieValue) {
        return false;
    }

    const [raw, signature] = cookieValue.split(".");
    if (!raw || !signature) {
        return false;
    }

    const env = getEnv();
    const expectedSignature = createHmac("sha256", env.CSRF_SECRET).update(raw).digest("hex");

    try {
        const signatureMatches = timingSafeEqual(Buffer.from(signature, "hex"), Buffer.from(expectedSignature, "hex"));
        const stateMatches = timingSafeEqual(Buffer.from(stateParam, "utf8"), Buffer.from(raw, "utf8"));
        return signatureMatches && stateMatches;
    } catch {
        return false;
    }
};
