import type { Message } from "@onamea/crdt"
import { getMessageId } from "@onamea/crdt"

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

interface OperationStoreStorage {
  sql: SqlStorage
  transactionSync<Result>(callback: () => Result): Result
}

type MessageRow = { message_key: string; message_json: string }

export const migrateMessageIds = async (storage: OperationStoreStorage): Promise<void> => {
  const { sql } = storage
  const isApplied = (): boolean =>
    sql.exec<{ version: number }>("SELECT version FROM schema_migrations WHERE version = ?", 1).toArray().length > 0

  if (isApplied()) return

  const rows = sql.exec<MessageRow>("SELECT message_key, message_json FROM messages ORDER BY message_key").toArray()
  const messageIds = await Promise.all(
    rows.map(async ({ message_json }) => await getMessageId(JSON.parse(message_json) as Message))
  )

  storage.transactionSync(() => {
    if (isApplied()) return

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index]!
      const messageId = messageIds[index]!
      if (row.message_key === messageId) continue

      sql.exec("INSERT OR IGNORE INTO messages (message_key, message_json) VALUES (?, ?)", messageId, row.message_json)
      sql.exec("DELETE FROM messages WHERE message_key = ?", row.message_key)
    }

    sql.exec("INSERT INTO schema_migrations (version) VALUES (?)", 1)
  })
}
