import Redis from "ioredis";
import { getEnv } from "@/config/env";

let client: Redis | null = null;

export const getRedis = (): Redis => {
    if (client) {
        return client;
    }

    const env = getEnv();
    client = new Redis(env.REDIS_URL, {
        lazyConnect: false
    });

    client.on("error", (error) => {
        console.error("Redis connection error", error);
    });

    return client;
};
