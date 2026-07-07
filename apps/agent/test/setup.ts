// Provide the env vars that src/lib/env.ts validates at import time.
process.env.DATABASE_URL ??= "postgresql://user:pass@localhost:5432/test";
process.env.AUTH_SECRET ??= "test-secret";
process.env.GOOGLE_CLIENT_ID ??= "test-client-id";
process.env.GOOGLE_CLIENT_SECRET ??= "test-client-secret";
process.env.ALLOWED_GOOGLE_EMAIL ??= "test@example.com";
process.env.AGENT_MODEL_PROVIDER ??= "openai";
process.env.AGENT_MODEL ??= "gpt-4o-mini";
process.env.OPENAI_API_KEY ??= "sk-test";
