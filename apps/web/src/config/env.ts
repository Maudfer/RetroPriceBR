import { z } from "zod";

const envSchema = z.object({
    DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
    REDIS_URL: z.string().min(1, "REDIS_URL is required"),
    GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
    GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),
    AUTH_REDIRECT_URI: z.string().url("AUTH_REDIRECT_URI must be a valid URL"),
    JWT_PRIVATE_KEY: z.string().min(1, "JWT_PRIVATE_KEY is required"),
    JWT_PUBLIC_KEY: z.string().min(1, "JWT_PUBLIC_KEY is required"),
    JWT_KEY_ID: z.string().min(1).default("retroprice-dev-key"),
    AUTH_SUCCESS_REDIRECT: z.string().min(1).default("/"),
    AUTH_ERROR_REDIRECT: z.string().min(1).default("/auth/error"),
    REFRESH_TOKEN_SECRET: z.string().min(1, "REFRESH_TOKEN_SECRET is required"),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    REFRESH_TOKEN_COOKIE_NAME: z.string().min(1).default("rp_refresh"),
    REFRESH_TOKEN_COOKIE_DOMAIN: z.string().optional(),
    ACCESS_TOKEN_TTL_MINUTES: z.coerce.number().int().positive().default(15),
    RATE_LIMIT_RPM: z.coerce.number().int().positive().default(120),
    CSRF_SECRET: z.string().min(1, "CSRF_SECRET is required"),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development")
});

let cachedEnv: Env | null = null;

export type Env = z.infer<typeof envSchema>;

export const getEnv = (): Env => {
    if (cachedEnv) {
        return cachedEnv;
    }

    const parsed = envSchema.safeParse({
        ...process.env,
        NODE_ENV: process.env.NODE_ENV ?? "development"
    });

    if (!parsed.success) {
        const formatted = parsed.error.flatten().fieldErrors;
        const messages = Object.entries(formatted)
            .map(([key, errors]) => `${key}: ${errors?.join(", ") ?? "invalid"}`)
            .join("\n");

        throw new Error(`Invalid environment configuration:\n${messages}`);
    }

    cachedEnv = parsed.data;
    return cachedEnv;
};
