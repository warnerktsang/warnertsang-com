import "server-only";
import {
  Configuration,
  CountryCode,
  PlaidApi,
  PlaidEnvironments,
  Products,
} from "plaid";
import { env } from "@/lib/env";

function getPlaidConfig() {
  if (!env.PLAID_CLIENT_ID || !env.PLAID_SECRET) {
    throw new Error("Plaid credentials are not configured");
  }
  if (!env.FINANCE_ENCRYPTION_KEY) {
    throw new Error("Finance encryption key is not configured");
  }
  return {
    clientId: env.PLAID_CLIENT_ID,
    secret: env.PLAID_SECRET,
  };
}

export function createPlaidClient(): PlaidApi {
  const config = getPlaidConfig();
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env.PLAID_ENV],
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": config.clientId,
          "PLAID-SECRET": config.secret,
        },
      },
    }),
  );
}

export function createPlaidLinkTokenRequest(userId: string) {
  getPlaidConfig();
  return {
    user: { client_user_id: userId },
    client_name: "Personal Agent OS",
    products: [Products.Transactions],
    country_codes: [CountryCode.Us],
    language: "en",
    transactions: { days_requested: 90 },
  };
}
