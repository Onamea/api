import type { Message, Operation } from "@onamea/crdt"

export type StoredOperationMessage = {
  operation: Operation
  message: Message
  isOwnerSigned: boolean
}

export type AppendResult = {
  records: StoredOperationMessage[]
  added: StoredOperationMessage[]
  isIdentity: boolean
  becameIdentity: boolean
}

interface SqlCursor<Row> {
  toArray(): Row[]
}

interface SqlStorage {
  exec<Row extends Record<string, unknown> = Record<string, unknown>>(
    query: string,
    ...bindings: (string | number)[]
  ): SqlCursor<Row>
}

interface OperationStoreState {
  storage: {
    sql: SqlStorage
    transactionSync<Result>(callback: () => Result): Result
  }
}

interface DurableObjectStub {
  fetch(input: Request | string | URL, init?: RequestInit): Promise<Response>
}

export interface DurableObjectIdLike {}

export interface OperationStoreNamespace {
  idFromName(name: string): DurableObjectIdLike
  get(id: DurableObjectIdLike): DurableObjectStub
}

type OperationRow = { hash: string; operation_json: string }
type MessageRow = { operation_hash: string; message_json: string }

export class OperationStore {
  private readonly state: OperationStoreState
  private readonly sql: SqlStorage

  constructor(state: OperationStoreState) {
    this.state = state
    this.sql = state.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS operations (
        hash TEXT PRIMARY KEY,
        operation_json TEXT NOT NULL
      )
    `)
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        operation_hash TEXT NOT NULL,
        crypto_name TEXT NOT NULL,
        public_key TEXT NOT NULL,
        signature TEXT NOT NULL,
        owner_signed INTEGER NOT NULL DEFAULT 0,
        message_json TEXT NOT NULL,
        PRIMARY KEY (operation_hash, crypto_name, public_key, signature)
      )
    `)
    const messageColumns = this.sql.exec<{ name: string }>("PRAGMA table_info(messages)").toArray()
    if (messageColumns.some(({ name }) => name === "owner_signed") === false) {
      this.sql.exec("ALTER TABLE messages ADD COLUMN owner_signed INTEGER NOT NULL DEFAULT 0")
    }
  }

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/append") {
      return new Response("Not found", { status: 404 })
    }

    try {
      const payload: unknown = await request.json()
      if (
        Array.isArray(payload) === false ||
        payload.length === 0 ||
        payload.some(
          record => typeof record !== "object" || record === null || !("operation" in record) || !("message" in record)
        )
      ) {
        return Response.json({ error: "Invalid operation records" }, { status: 400 })
      }

      const incomingRecords = payload as StoredOperationMessage[]
      const entityId = incomingRecords[0].operation.id
      if (incomingRecords.some(({ operation }) => operation.id !== entityId)) {
        return Response.json({ error: "All records must belong to one entity" }, { status: 400 })
      }

      const { added, isIdentity, becameIdentity } = this.state.storage.transactionSync(() => {
        const wasIdentity = this.hasOwnerSignedCreate()
        const existingOperations = this.sql
          .exec<{ operation_json: string }>("SELECT operation_json FROM operations")
          .toArray()
        const hasCreate = existingOperations.some(
          ({ operation_json }) => (JSON.parse(operation_json) as Operation).type === "CREATE"
        )
        if (hasCreate === false && incomingRecords.some(({ operation }) => operation.type === "CREATE") === false) {
          throw new Error(`Entity ${entityId} does not exist and no CREATE operation was supplied`)
        }

        const addedRecords: StoredOperationMessage[] = []
        for (const record of incomingRecords) {
          const { operation, message } = record
          const exists =
            this.sql
              .exec<{ found: number }>(
                `SELECT 1 AS found FROM messages
             WHERE operation_hash = ? AND crypto_name = ? AND public_key = ? AND signature = ?
             LIMIT 1`,
                operation.hash,
                message.cryptoName,
                message.publicKey,
                message.signature
              )
              .toArray().length > 0
          if (exists) {
            if (record.isOwnerSigned) {
              this.sql.exec(
                `UPDATE messages SET owner_signed = 1
                 WHERE operation_hash = ? AND crypto_name = ? AND public_key = ? AND signature = ?`,
                operation.hash,
                message.cryptoName,
                message.publicKey,
                message.signature
              )
            }
            continue
          }

          this.sql.exec(
            "INSERT OR IGNORE INTO operations (hash, operation_json) VALUES (?, ?)",
            operation.hash,
            JSON.stringify(operation)
          )
          this.sql.exec(
            `INSERT INTO messages (operation_hash, crypto_name, public_key, signature, owner_signed, message_json)
             VALUES (?, ?, ?, ?, ?, ?)`,
            operation.hash,
            message.cryptoName,
            message.publicKey,
            message.signature,
            record.isOwnerSigned ? 1 : 0,
            JSON.stringify(message)
          )
          addedRecords.push(record)
        }
        const isIdentity = this.hasOwnerSignedCreate()
        return { added: addedRecords, isIdentity, becameIdentity: isIdentity && !wasIdentity }
      })

      const operations = new Map(
        this.sql
          .exec<OperationRow>("SELECT hash, operation_json FROM operations")
          .toArray()
          .map(row => [row.hash, JSON.parse(row.operation_json) as Operation])
      )
      const storedRecords: StoredOperationMessage[] = this.sql
        .exec<MessageRow & { owner_signed: number }>(
          `SELECT operation_hash, message_json, owner_signed FROM messages
           ORDER BY operation_hash, crypto_name, public_key, signature`
        )
        .toArray()
        .map(row => ({
          operation: operations.get(row.operation_hash)!,
          message: JSON.parse(row.message_json) as Message,
          isOwnerSigned: row.owner_signed === 1
        }))

      return Response.json({ records: storedRecords, added, isIdentity, becameIdentity } satisfies AppendResult)
    } catch (error) {
      return Response.json({ error: error instanceof Error ? error.message : String(error) }, { status: 400 })
    }
  }

  private hasOwnerSignedCreate(): boolean {
    return this.sql
      .exec<{ operation_json: string }>(
        `SELECT operations.operation_json
         FROM operations
         JOIN messages ON messages.operation_hash = operations.hash
         WHERE messages.owner_signed = 1`
      )
      .toArray()
      .some(({ operation_json }) => (JSON.parse(operation_json) as Operation).type === "CREATE")
  }
}

export const createOperationStore = (namespace: OperationStoreNamespace) => ({
  append: async (id: string, records: StoredOperationMessage[]): Promise<AppendResult> => {
    const objectId = namespace.idFromName(id)
    const response = await namespace.get(objectId).fetch("https://operation-store/append", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(records)
    })
    const result = (await response.json()) as AppendResult | { error?: string }
    if (!response.ok) {
      throw new Error("error" in result ? (result.error ?? "Operation append failed") : "Operation append failed")
    }
    return result as AppendResult
  }
})
