export interface AgentStatus {
  status: "ok";
  version: "0.1.0";
}

export function getAgentStatus(): AgentStatus {
  return {
    status: "ok",
    version: "0.1.0",
  };
}
