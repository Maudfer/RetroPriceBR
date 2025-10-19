import { SignJWT, decodeJwt, jwtVerify, type JWTPayload } from "jose";
import { getEnv } from "@/config/env";
import { getPrivateKey, getPublicKey } from "@/lib/auth/keys";

const ISSUER = "retropricebr/web";
const AUDIENCE = "retropricebr/api";

type RolesClaim = string[];

export interface AccessTokenPayload {
    sub: string;
    email: string;
    name: string;
    reputation: number;
    roles: RolesClaim;
    isVerifiedStore: boolean;
}

export const issueAccessToken = async (payload: AccessTokenPayload): Promise<string> => {
    const env = getEnv();
    const privateKey = await getPrivateKey();
    const now = Math.floor(Date.now() / 1000);

    return new SignJWT({
        email: payload.email,
        name: payload.name,
        rep: payload.reputation,
        roles: payload.roles,
        ver: payload.isVerifiedStore
    })
        .setProtectedHeader({ alg: "RS256", kid: env.JWT_KEY_ID })
        .setIssuedAt(now)
        .setIssuer(ISSUER)
        .setAudience(AUDIENCE)
        .setSubject(payload.sub)
        .setExpirationTime(`${env.ACCESS_TOKEN_TTL_MINUTES}m`)
        .sign(privateKey);
};

export interface VerifiedAccessToken extends JWTPayload {
    sub: string;
    email: string;
    name: string;
    rep: number;
    roles: RolesClaim;
    ver: boolean;
}

export const verifyAccessToken = async (token: string): Promise<VerifiedAccessToken> => {
    const publicKey = await getPublicKey();
    const { payload } = await jwtVerify(token, publicKey, {
        issuer: ISSUER,
        audience: AUDIENCE
    });

    if (!payload.sub || !payload.roles) {
        throw new Error("Invalid access token payload");
    }

    return payload as VerifiedAccessToken;
};

export const decodeAccessToken = (token: string): JWTPayload => decodeJwt(token);
