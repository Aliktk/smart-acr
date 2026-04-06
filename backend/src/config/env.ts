import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().default(4000),
  DATABASE_URL: z.string().min(1),
  JWT_ACCESS_SECRET: z.string().min(16),
  JWT_REFRESH_SECRET: z.string().min(16),
  ACCESS_TOKEN_TTL: z.string().default("15m"),
  REFRESH_TOKEN_TTL_DAYS: z.coerce.number().default(7),
  WEB_ORIGIN: z.string().default("http://localhost:3000"),
  STORAGE_PATH: z.string().default("storage"),
  FORGOT_PASSWORD_ENABLED: z.coerce.boolean().default(false),
  FORGOT_PASSWORD_TOKEN_TTL_MINUTES: z.coerce.number().default(30),
});

export type AppEnv = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>) {
  return envSchema.parse(config);
}
