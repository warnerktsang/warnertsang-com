import "server-only";
import { z } from "zod";

/**
 * Centralized, validated server environment. Importing this module from client
 * code will fail the build ("server-only"), which keeps secrets server-side.
 */
const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),

  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  // AUTH_URL is optional locally; required on Vercel for correct callback URLs.
  AUTH_URL: z.string().url().optional(),

  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID is required"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET is required"),

  // Only this Google account may access the app. Enforced server-side.
  ALLOWED_GOOGLE_EMAIL: z
    .string()
    .email("ALLOWED_GOOGLE_EMAIL must be a valid email"),

  AGENT_MODEL_PROVIDER: z.string().default("openai"),
  AGENT_MODEL: z.string().default("gpt-4o-mini"),
  OPENAI_API_KEY: z.string().optional(),

  MCP_BEARER_TOKEN: z.string().min(1).optional(),
  PLAID_ENV: z.enum(["production", "sandbox"]).default("production"),
  PLAID_CLIENT_ID: z.string().min(1).optional(),
  PLAID_SECRET: z.string().min(1).optional(),
  FINANCE_ENCRYPTION_KEY: z
    .string()
    .regex(/^[0-9a-fA-F]{64}$/, "FINANCE_ENCRYPTION_KEY must be 32-byte hex")
    .optional(),
});

function loadEnv() {
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  return parsed.data;
}

export const env = loadEnv();
export type Env = z.infer<typeof schema>;
