import { test } from "node:test"
import assert from "node:assert/strict"
import { keyPairFromPrivateKey } from "@onamea/types"
import { createCreateOperation, getMessageId, signMessage, toRawOperation } from "@onamea/crdt"
import { OperationStoreCore } from "../lib/db/operationStore.ts"
import type { Message } from "@onamea/crdt"
import { cryptoName, privateKey } from "./data.mock.ts"

type SqlValue = string | number | ArrayBuffer | null
type SqlRow = Record<string, SqlValue>
type MessageRow = { message_key: string; message_json: string }

const createSql = (initialRows: MessageRow[]) => {
  const rows = new Map(initialRows.map(row => [row.message_key, row.message_json]))
  const appliedMigrations = new Set<number>()
  const sql = {
    exec: <Row extends SqlRow = SqlRow>(query: string, ...bindings: (string | number)[]) => {
      let result: SqlRow[] = []

      if (query.startsWith("SELECT version FROM schema_migrations")) {
        const version = Number(bindings[0])
        if (appliedMigrations.has(version)) result = [{ version }]
      } else if (query.startsWith("SELECT message_key, message_json")) {
        result = [...rows]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([message_key, message_json]) => ({ message_key, message_json }))
      } else if (query.startsWith("SELECT 1 AS found")) {
        if (rows.has(String(bindings[0]))) result = [{ found: 1 }]
      } else if (query.startsWith("INSERT OR IGNORE")) {
        const [key, json] = bindings as [string, string]
        if (rows.has(key) === false) rows.set(key, json)
      } else if (query.startsWith("INSERT INTO schema_migrations")) {
        appliedMigrations.add(Number(bindings[0]))
      } else if (query.startsWith("INSERT INTO")) {
        const [key, json] = bindings as [string, string]
        rows.set(key, json)
      } else if (query.startsWith("DELETE FROM")) {
        rows.delete(String(bindings[0]))
      }

      return { toArray: () => result as Row[] }
    }
  }
  return { rows, sql }
}

test("initialize migrates legacy message keys once", async () => {
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const operation = await createCreateOperation("Item-message-key-migration")
  const message: Message = await signMessage({ raw: toRawOperation(operation) }, keyPair)
  const oldMessageKey = "legacy-message-key"
  const { rows, sql } = createSql([{ message_key: oldMessageKey, message_json: JSON.stringify(message) }])
  const store = new OperationStoreCore({
    storage: {
      sql,
      transactionSync: callback => callback()
    }
  })

  await store.initialize()
  const messageId = await getMessageId(message)

  assert.equal(rows.has(oldMessageKey), false)
  assert.equal(rows.has(messageId), true)
  assert.equal(rows.size, 1)

  await store.initialize()
  assert.equal(rows.size, 1)

  const append = await store.append([message])
  assert.equal(append.added.length, 0)
  assert.equal(rows.size, 1)
})
