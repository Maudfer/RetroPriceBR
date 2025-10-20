import { getRedis } from "./redis";

export interface RateLimiterOptions {
    prefix: string;
    limit: number;
    windowSeconds: number;
}

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number;
}

export const createRateLimiter = (options: RateLimiterOptions) => {
    const redis = getRedis();
    const { prefix, limit, windowSeconds } = options;

    return async (key: string): Promise<RateLimitResult> => {
        const redisKey = `${prefix}:${key}`;

        const pipeline = redis.multi();
        pipeline.incr(redisKey);
        pipeline.expire(redisKey, windowSeconds, "NX");
        pipeline.ttl(redisKey);

        const results = await pipeline.exec();
        const countResult = Number(results?.[0]?.[1] ?? 0);
        const ttlLookup = Number(results?.[2]?.[1] ?? windowSeconds);
        const ttlSeconds = ttlLookup > 0 ? ttlLookup : windowSeconds;

        const remaining = Math.max(limit - countResult, 0);
        const allowed = countResult <= limit;
        const resetAt = Date.now() + ttlSeconds * 1000;

        return { allowed, remaining, resetAt };
    };
};
