import { test } from "node:test"
import assert from "node:assert/strict"
import { keyPairFromPrivateKey } from "@onamea/types"
import { createCreateOperation, getMessageId, signMessage, toRawOperation } from "@onamea/crdt"
import { OperationStoreCore } from "../lib/db/operationStore.ts"
import type { Message } from "@onamea/crdt"
import { cryptoName, privateKey } from "./data.mock.ts"

type SqlValue = string | number | ArrayBuffer | null
type SqlRow = Record<string, SqlValue>

const createSql = () => {
  const rows = new Map<string, string>()
  const sql = {
    exec: <Row extends SqlRow = SqlRow>(query: string, ...bindings: (string | number)[]) => {
      let result: SqlRow[] = []

      if (query.startsWith("SELECT message_key, message_json")) {
        result = [...rows]
          .sort(([left], [right]) => left.localeCompare(right))
          .map(([message_key, message_json]) => ({ message_key, message_json }))
      } else if (query.startsWith("SELECT message_json FROM messages WHERE message_key")) {
        const message_json = rows.get(String(bindings[0]))
        if (message_json !== undefined) result = [{ message_json }]
      } else if (query.startsWith("SELECT 1 AS found")) {
        if (rows.has(String(bindings[0]))) result = [{ found: 1 }]
      } else if (query.startsWith("INSERT INTO")) {
        const [key, json] = bindings as [string, string]
        rows.set(key, json)
      }

      return { toArray: () => result as Row[] }
    }
  }
  return { rows, sql }
}

test("stores messages by message ID and avoids duplicates", async () => {
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const operation = await createCreateOperation("Item-message-key")
  const message: Message = await signMessage({ raw: toRawOperation(operation) }, keyPair)
  const { rows, sql } = createSql()
  const store = new OperationStoreCore({
    storage: {
      sql,
      transactionSync: callback => callback()
    }
  })

  const messageId = await getMessageId(message)

  const firstAppend = await store.append([message])
  assert.equal(firstAppend.added.length, 1)
  assert.equal(rows.has(messageId), true)
  assert.equal(rows.size, 1)

  const append = await store.append([message])
  assert.equal(append.added.length, 0)
  assert.equal(rows.size, 1)
  assert.deepEqual(store.getMessage(messageId), JSON.parse(JSON.stringify(message)))
  assert.equal(store.getMessage("0".repeat(64)), undefined)
})
