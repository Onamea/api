import { createHash } from "node:crypto"
import { isNameKey } from "@onamea/types"
import type { Message, Operation } from "@onamea/crdt"
import { isMessage, isSignedByOwner, parseRawOperation } from "@onamea/crdt"

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

type SqlStorageValue = string | number | ArrayBuffer | null

interface SqlCursor<Row extends Record<string, SqlStorageValue>> {
  toArray(): Row[]
}

interface SqlStorage {
  exec<Row extends Record<string, SqlStorageValue> = Record<string, SqlStorageValue>>(
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

export interface OperationStoreStub {
  append(messages: Message[]): Promise<AppendResult>
  getMessages(): Promise<Message[]>
}

export interface DurableObjectIdLike {}

export interface OperationStoreNamespace {
  idFromName(name: string): DurableObjectIdLike
  get(id: DurableObjectIdLike): OperationStoreStub
}

type MessageRow = { message_key: string; message_json: string }

const messageKey = (message: Message): string =>
  createHash("sha256")
    .update(JSON.stringify([message.raw, message.cryptoName, message.publicKey, message.signature]), "utf8")
    .digest("hex")

const toStoredRecords = async (messages: Message[]): Promise<StoredOperationMessage[]> =>
  await Promise.all(
    messages.map(async message => {
      const operation = await parseRawOperation(message.raw)
      return {
        operation,
        message,
        isOwnerSigned: isNameKey(operation.id) && (await isSignedByOwner(message))
      }
    })
  )

const hasOwnerSignedCreate = (records: StoredOperationMessage[]): boolean =>
  records.some(({ operation, isOwnerSigned }) => isOwnerSigned && operation.type === "CREATE")

export class OperationStoreCore {
  private readonly state: OperationStoreState
  private readonly sql: SqlStorage

  constructor(state: OperationStoreState) {
    this.state = state
    this.sql = state.storage.sql
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        message_key TEXT PRIMARY KEY,
        message_json TEXT NOT NULL
      )
    `)
  }

  async append(messages: Message[]): Promise<AppendResult> {
    if (Array.isArray(messages) === false || messages.length === 0 || messages.every(isMessage) === false) {
      throw new Error("Invalid Messages")
    }

    const incomingRecords = await toStoredRecords(messages)
    const entityId = incomingRecords[0].operation.id
    if (incomingRecords.some(({ operation }) => operation.id !== entityId)) {
      throw new Error("All messages must belong to one entity")
    }

    const existingRecords = await this.getRecords()
    if (existingRecords.some(({ operation }) => operation.id !== entityId)) {
      throw new Error("Messages must belong to one entity")
    }
    const wasIdentity = hasOwnerSignedCreate(existingRecords)
    const hasCreate = existingRecords.some(({ operation }) => operation.type === "CREATE")
    const { added } = this.state.storage.transactionSync(() => {
      if (hasCreate === false && incomingRecords.some(({ operation }) => operation.type === "CREATE") === false) {
        throw new Error(`Entity ${entityId} does not exist and no CREATE operation was supplied`)
      }

      const addedRecords: StoredOperationMessage[] = []
      for (const record of incomingRecords) {
        const exists =
          this.sql
            .exec<{ found: number }>(
              "SELECT 1 AS found FROM messages WHERE message_key = ? LIMIT 1",
              messageKey(record.message)
            )
            .toArray().length > 0
        if (exists) {
          continue
        }

        this.sql.exec(
          "INSERT INTO messages (message_key, message_json) VALUES (?, ?)",
          messageKey(record.message),
          JSON.stringify(record.message)
        )
        addedRecords.push(record)
      }
      return { added: addedRecords }
    })

    const storedRecords = await this.getRecords()
    const isIdentity = hasOwnerSignedCreate(storedRecords)

    return {
      records: storedRecords,
      added,
      isIdentity,
      becameIdentity: isIdentity && !wasIdentity
    }
  }

  private async getRecords(): Promise<StoredOperationMessage[]> {
    const messages = this.getMessages()
    const records = await toStoredRecords(messages)
    return records.sort(
      (left, right) =>
        left.operation.hash.localeCompare(right.operation.hash) ||
        left.message.cryptoName.localeCompare(right.message.cryptoName) ||
        left.message.publicKey.localeCompare(right.message.publicKey) ||
        left.message.signature.localeCompare(right.message.signature)
    )
  }

  getMessages(): Message[] {
    return this.sql
      .exec<MessageRow>("SELECT message_key, message_json FROM messages ORDER BY message_key")
      .toArray()
      .map(({ message_json }) => JSON.parse(message_json) as Message)
  }
}

export const createOperationStore = (namespace: OperationStoreNamespace) => ({
  append: async (id: string, messages: Message[]): Promise<AppendResult> => {
    const objectId = namespace.idFromName(id)
    return await namespace.get(objectId).append(messages)
  },

  getMessages: async (id: string): Promise<Message[]> => {
    const objectId = namespace.idFromName(id)
    return await namespace.get(objectId).getMessages()
  }
})
