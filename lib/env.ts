import type { createWorkersKv, WorkersKVNamespace } from "./db/workersKv.ts"
import type { createOperationStore, OperationStoreNamespace } from "./db/operationStore.ts"

export type AppEnv = {
  Bindings: {
    ONAMEA_KV: WorkersKVNamespace
    OPERATION_STORE: OperationStoreNamespace
  }
  Variables: {
    db: ReturnType<typeof createWorkersKv>
    operationStore: ReturnType<typeof createOperationStore>
  }
}
