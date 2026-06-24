import type { PlanBlock, WorkOrder } from "./scheduler-model";
import { buildNetSuiteUpdatePayload } from "./scheduler-model";

export type NetSuiteConnectionConfig = {
  accountId: string;
  consumerKey: string;
  consumerSecret: string;
  tokenId: string;
  tokenSecret: string;
  restletBaseUrl?: string;
};

export type NetSuiteScheduleUpdate = ReturnType<typeof buildNetSuiteUpdatePayload>[number];

export type NetSuiteAdapter = {
  fetchReleasedWorkOrders(): Promise<WorkOrder[]>;
  updateWorkOrderSchedule(blocks: PlanBlock[]): Promise<NetSuiteScheduleUpdate[]>;
};

export function createNetSuiteAdapter(
  config: NetSuiteConnectionConfig,
): NetSuiteAdapter {
  return {
    async fetchReleasedWorkOrders() {
      assertConfigured(config);
      throw new Error(
        "NetSuite fetch is not connected yet. Add a server route that calls SuiteTalk REST, a RESTlet, or a saved-search export and maps records to WorkOrder.",
      );
    },
    async updateWorkOrderSchedule(blocks) {
      assertConfigured(config);
      const payload = buildNetSuiteUpdatePayload(blocks);
      throw new Error(
        `NetSuite update is not connected yet. ${payload.length} work order schedule updates are ready to post from a server route.`,
      );
    },
  };
}

export function readNetSuiteConfigFromEnv(env: Record<string, string | undefined>) {
  return {
    accountId: env.NETSUITE_ACCOUNT_ID ?? "",
    consumerKey: env.NETSUITE_CONSUMER_KEY ?? "",
    consumerSecret: env.NETSUITE_CONSUMER_SECRET ?? "",
    tokenId: env.NETSUITE_TOKEN_ID ?? "",
    tokenSecret: env.NETSUITE_TOKEN_SECRET ?? "",
    restletBaseUrl: env.NETSUITE_RESTLET_BASE_URL,
  };
}

function assertConfigured(config: NetSuiteConnectionConfig) {
  const missing = [
    ["NETSUITE_ACCOUNT_ID", config.accountId],
    ["NETSUITE_CONSUMER_KEY", config.consumerKey],
    ["NETSUITE_CONSUMER_SECRET", config.consumerSecret],
    ["NETSUITE_TOKEN_ID", config.tokenId],
    ["NETSUITE_TOKEN_SECRET", config.tokenSecret],
  ]
    .filter(([, value]) => !value)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Missing NetSuite environment variables: ${missing.join(", ")}`);
  }
}
