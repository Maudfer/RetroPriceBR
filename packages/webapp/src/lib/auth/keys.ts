import { exportJWK, importPKCS8, importSPKI, type JWK, type KeyLike } from "jose";
import { getEnv } from "../../config/env";

let privateKeyPromise: Promise<KeyLike> | null = null;
let publicKeyPromise: Promise<KeyLike> | null = null;
let jwkPromise: Promise<JWK> | null = null;

export const getPrivateKey = async (): Promise<KeyLike> => {
    if (!privateKeyPromise) {
        const env = getEnv();
        privateKeyPromise = importPKCS8(env.JWT_PRIVATE_KEY, "RS256");
    }

    return privateKeyPromise;
};

export const getPublicKey = async (): Promise<KeyLike> => {
    if (!publicKeyPromise) {
        const env = getEnv();
        publicKeyPromise = importSPKI(env.JWT_PUBLIC_KEY, "RS256");
    }

    return publicKeyPromise;
};

export const getJwk = async (): Promise<JWK> => {
    if (!jwkPromise) {
        const env = getEnv();
        jwkPromise = getPublicKey().then((key) => exportJWK(key).then((jwk) => ({
            ...jwk,
            kid: env.JWT_KEY_ID,
            alg: "RS256",
            use: "sig"
        })));
    }

    return jwkPromise;
};
