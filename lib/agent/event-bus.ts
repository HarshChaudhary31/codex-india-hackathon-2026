import { randomUUID } from "node:crypto";

import type { AgentEvent, AgentPhase } from "@/lib/agent/types";

export class AgentEventBus {
  private readonly events: AgentEvent[] = [];

  constructor(private readonly runId: string) {}

  emit(
    type: AgentEvent["type"],
    phase: AgentPhase,
    message: string,
    data?: Record<string, unknown>,
  ): AgentEvent {
    const event: AgentEvent = {
      id: randomUUID(),
      runId: this.runId,
      timestamp: new Date().toISOString(),
      type,
      phase,
      message,
      data,
    };

    this.events.push(event);
    return event;
  }

  list(): AgentEvent[] {
    return [...this.events];
  }
}
