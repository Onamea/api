import { isNameKey } from "@onamea/types"
import type { Message, Operation } from "@onamea/crdt"
import { getMessageId, isMessage, isSignedByOwner, parseRawOperation } from "@onamea/crdt"
import { migrateMessageIds } from "./migrations/001-message-id.ts"

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
    this.sql.exec(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY
      )
    `)
  }

  async initialize(): Promise<void> {
    await migrateMessageIds(this.state.storage)
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

    const existingRows = this.getMessageRows()
    const existingMessages = existingRows.map(({ message_json }) => JSON.parse(message_json) as Message)
    const existingRecords = await toStoredRecords(existingMessages)
    if (existingRecords.some(({ operation }) => operation.id !== entityId)) {
      throw new Error("Messages must belong to one entity")
    }
    const wasIdentity = hasOwnerSignedCreate(existingRecords)
    const hasCreate = existingRecords.some(({ operation }) => operation.type === "CREATE")
    const incomingMessageIds = await Promise.all(
      incomingRecords.map(async ({ message }) => await getMessageId(message))
    )
    const { added } = this.state.storage.transactionSync(() => {
      if (hasCreate === false && incomingRecords.some(({ operation }) => operation.type === "CREATE") === false) {
        throw new Error(`Entity ${entityId} does not exist and no CREATE operation was supplied`)
      }

      const knownMessageIds = new Set(existingRows.map(({ message_key }) => message_key))

      const addedRecords: StoredOperationMessage[] = []
      for (let index = 0; index < incomingRecords.length; index += 1) {
        const record = incomingRecords[index]!
        const messageId = incomingMessageIds[index]!
        if (knownMessageIds.has(messageId)) continue

        const exists =
          this.sql
            .exec<{ found: number }>("SELECT 1 AS found FROM messages WHERE message_key = ? LIMIT 1", messageId)
            .toArray().length > 0
        if (exists) {
          knownMessageIds.add(messageId)
          continue
        }

        this.sql.exec(
          "INSERT INTO messages (message_key, message_json) VALUES (?, ?)",
          messageId,
          JSON.stringify(record.message)
        )
        addedRecords.push(record)
        knownMessageIds.add(messageId)
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

  private getMessageRows(): MessageRow[] {
    return this.sql.exec<MessageRow>("SELECT message_key, message_json FROM messages ORDER BY message_key").toArray()
  }

  getMessages(): Message[] {
    return this.getMessageRows().map(({ message_json }) => JSON.parse(message_json) as Message)
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
