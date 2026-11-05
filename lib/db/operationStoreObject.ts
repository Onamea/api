/// <reference types="@cloudflare/workers-types" />

import { DurableObject } from "cloudflare:workers"
import type { Message } from "@onamea/crdt"
import { OperationStoreCore, type AppendResult } from "./operationStore.ts"

type OperationStoreContext = ConstructorParameters<typeof DurableObject>[0]

export class OperationStoreV2 extends DurableObject<unknown> {
  private readonly store: OperationStoreCore

  constructor(ctx: OperationStoreContext, env: unknown) {
    super(ctx, env)
    this.store = new OperationStoreCore(ctx)
  }

  async append(messages: Message[]): Promise<AppendResult> {
    return await this.store.append(messages)
  }

  async getMessages(): Promise<Message[]> {
    return this.store.getMessages()
  }
}
