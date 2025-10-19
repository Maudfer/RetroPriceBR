import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import { getEnv } from "@/config/env";

const TOKEN_BYTES = 32;

export interface CsrfPair {
    headerValue: string;
    cookieValue: string;
}

export const generateCsrfPair = (): CsrfPair => {
    const env = getEnv();
    const raw = randomBytes(TOKEN_BYTES).toString("hex");
    const signature = createHmac("sha256", env.CSRF_SECRET).update(raw).digest("hex");
    return {
        headerValue: raw,
        cookieValue: `${raw}.${signature}`
    };
};

export const validateCsrf = (headerToken: string | null | undefined, cookieValue: string | undefined): boolean => {
    if (!headerToken || !cookieValue) {
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
        const tokenMatches = timingSafeEqual(Buffer.from(headerToken, "utf8"), Buffer.from(raw, "utf8"));
        return signatureMatches && tokenMatches;
    } catch {
        return false;
    }
};
