import { test } from "node:test"
import assert from "node:assert/strict"
import { keyPairFromPrivateKey } from "@onamea/types"
import {
  createCreateOperation,
  createSetOperation,
  signMessage,
  toRawOperation,
  isCreateIdentityMessage
} from "@onamea/crdt"
import app from "../app.ts"
import type { WorkersKVNamespace } from "../lib/db/workersKv.ts"
import type { OperationStoreNamespace, StoredOperationMessage } from "../lib/db/operationStore.ts"
import { cryptoName, privateKey } from "./data.mock.ts"

const operationStores = new WeakMap<WorkersKVNamespace, OperationStoreNamespace>()

const createMemoryOperationStore = (): OperationStoreNamespace => {
  const names = new WeakMap<object, string>()
  const entities = new Map<string, StoredOperationMessage[]>()
  const hasOwnerSignedCreate = async (records: StoredOperationMessage[]) => {
    for (const { message } of records) {
      if (await isCreateIdentityMessage(message)) return true
    }
    return false
  }
  return {
    idFromName: name => {
      const id = {}
      names.set(id, name)
      return id
    },
    get: id => ({
      fetch: async (input, init) => {
        const request = new Request(input, init)
        const incoming = (await request.json()) as StoredOperationMessage[]
        const entityId = names.get(id as object)!
        const existing = entities.get(entityId) ?? []
        const wasIdentity = await hasOwnerSignedCreate(existing)
        const existingMessageKeys = new Set(
          existing.map(({ operation, message }) =>
            JSON.stringify([operation.hash, message.cryptoName, message.publicKey, message.signature])
          )
        )
        const added = incoming.filter(({ operation, message }) => {
          const key = JSON.stringify([operation.hash, message.cryptoName, message.publicKey, message.signature])
          if (existingMessageKeys.has(key)) return false
          existingMessageKeys.add(key)
          return true
        })
        const records = [...existing, ...added]
        entities.set(entityId, records)
        const isIdentity = await hasOwnerSignedCreate(records)
        return Response.json({ records, added, isIdentity, becameIdentity: isIdentity && !wasIdentity })
      }
    })
  }
}

const createMemoryKv = (): WorkersKVNamespace => {
  const entries = new Map<string, string>()
  const kv = {
    get: async (key: string, type: "json") => {
      const value = entries.get(key)
      return value === undefined ? null : type === "json" ? JSON.parse(value) : value
    },
    put: async (key: string, value: string) => {
      entries.set(key, value)
    },
    list: async ({ prefix, limit, cursor }: { prefix: string; limit: number; cursor?: string }) => {
      const keys = [...entries.keys()].filter(key => key.startsWith(prefix)).sort()
      const start = cursor === undefined ? 0 : Number(cursor)
      const pageKeys = keys.slice(start, start + limit)
      const next = start + pageKeys.length
      return {
        keys: pageKeys.map(name => ({ name })),
        list_complete: next >= keys.length,
        ...(next < keys.length ? { cursor: String(next) } : {})
      }
    }
  }
  const workersKv = kv as WorkersKVNamespace
  operationStores.set(workersKv, createMemoryOperationStore())
  return workersKv
}

const request = (kv: WorkersKVNamespace, path: string, init?: RequestInit) =>
  app.request(path, init, { ONAMEA_KV: kv, OPERATION_STORE: operationStores.get(kv)! })

test("POST / single operation", async () => {
  const kv = createMemoryKv()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const operation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const message = await signMessage({ raw: toRawOperation(operation) }, keyPair)

  const response = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 1)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[0].displayName, "Vani💪❤️❤️🎄🌙🔥")
  assert.equal(body[0].operations[0].type, "CREATE")
  assert.equal(body[0].operations.length, 1)

  const identityResponse = await request(kv, "/identities/id/Vani%4046G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(identityResponse.status, 200)
  assert.equal(((await identityResponse.json()) as { id: string }).id, body[0].id)
})

test("POST / two operations", async () => {
  const kv = createMemoryKv()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation) }, keyPair),
    await signMessage(
      {
        raw: `Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02
${createOperation.hash}
SET
body
line2
`
      },
      keyPair
    )
  ]

  const response = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 1)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[0].operations.length, 2)
  assert.equal(body[0].operations[0].type, "CREATE")
  assert.equal(body[0].operations[1].type, "SET")
  assert.equal(body[0].body, "body\nline2\n")
})

test("POST / two CREATE operations", async () => {
  const kv = createMemoryKv()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation1 = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const createOperation2 = await createCreateOperation("Item-1")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation1) }, keyPair),
    await signMessage({ raw: toRawOperation(createOperation2) }, keyPair)
  ]

  const response = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 2)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[1].id, "Item-1")

  const itemResponse = await request(kv, "/items/id/Item-1")
  assert.equal(itemResponse.status, 200)
  assert.equal(((await itemResponse.json()) as { id: string }).id, "Item-1")
})

test("POST / accepts IDs matching object prototype properties", async () => {
  const kv = createMemoryKv()
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const messages = await Promise.all(
    ["constructor", "__proto__"].map(async id => {
      const operation = await createCreateOperation(id)
      return await signMessage({ raw: toRawOperation(operation) }, keyPair)
    })
  )

  const response = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = (await response.json()) as { id: string }[]
  assert.deepEqual(
    body.map(({ id }) => id),
    ["constructor", "__proto__"]
  )
})

test("POST / concurrent operations preserve all messages", async () => {
  const kv = createMemoryKv()
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation = await createCreateOperation("Item-concurrent")
  const createMessage = await signMessage({ raw: toRawOperation(createOperation) }, keyPair)

  const createResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createMessage)
  })
  assert.equal(createResponse.status, 200)

  const createSetMessage = async (value: string) =>
    await signMessage({ raw: `Item-concurrent\n${createOperation.hash}\nSET\n${value}\n` }, keyPair)
  const messages = await Promise.all([createSetMessage("left"), createSetMessage("right")])

  const responses = await Promise.all(
    messages.map(message =>
      request(kv, "/", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(message)
      })
    )
  )
  assert.deepEqual(
    responses.map(({ status }) => status),
    [200, 200]
  )

  const itemResponse = await request(kv, "/items/id/Item-concurrent")
  assert.equal(itemResponse.status, 200)
  const item = (await itemResponse.json()) as { operations: unknown[]; messages: unknown[] }
  assert.equal(item.operations.length, 3)
  assert.equal(item.messages.length, 3)
})

test("POST / preserves distinct messages for the same operation", async () => {
  const kv = createMemoryKv()
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const otherKeyPair = keyPairFromPrivateKey(
    cryptoName,
    "0000000000000000000000000000000000000000000000000000000000000001"
  )
  const createOperation = await createCreateOperation("Item-multisigned")
  const createMessage = await signMessage({ raw: toRawOperation(createOperation) }, keyPair)

  const createResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(createMessage)
  })
  assert.equal(createResponse.status, 200)

  const setOperation = await createSetOperation("Item-multisigned", createOperation.hash, "shared operation")
  const rawOperation = toRawOperation(setOperation)
  const messages = await Promise.all([
    signMessage({ raw: rawOperation }, keyPair),
    signMessage({ raw: rawOperation }, otherKeyPair)
  ])
  for (const message of messages) {
    const response = await request(kv, "/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(message)
    })
    assert.equal(response.status, 200)
  }

  const itemResponse = await request(kv, "/items/id/Item-multisigned")
  assert.equal(itemResponse.status, 200)
  const item = (await itemResponse.json()) as {
    operations: { hash: string }[]
    messages: { publicKey: string }[]
  }
  assert.equal(item.operations.length, 2)
  assert.equal(item.operations.filter(({ hash }) => hash === setOperation.hash).length, 1)
  assert.equal(item.messages.length, 3)
  assert.equal(new Set(item.messages.map(({ publicKey }) => publicKey)).size, 2)
})

test("POST / classifies a shared NameKey CREATE as an Identity", async () => {
  const kv = createMemoryKv()
  const ownerKeyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const otherKeyPair = keyPairFromPrivateKey(
    cryptoName,
    "0000000000000000000000000000000000000000000000000000000000000001"
  )
  const id = "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02"
  const createOperation = await createCreateOperation(id)
  const messages = await Promise.all([
    signMessage({ raw: toRawOperation(createOperation) }, otherKeyPair),
    signMessage({ raw: toRawOperation(createOperation) }, ownerKeyPair)
  ])

  const response = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = (await response.json()) as {
    id: string
    displayName: string
    operations: unknown[]
    messages: unknown[]
  }[]
  assert.equal(body.length, 1)
  assert.equal(body[0].id, id)
  assert.notEqual(body[0].displayName, id)
  assert.equal(body[0].operations.length, 1)
  assert.equal(body[0].messages.length, 2)

  const identityResponse = await request(kv, `/identities/id/${encodeURIComponent(id)}`)
  assert.equal(identityResponse.status, 200)
  const identity = (await identityResponse.json()) as { messages: unknown[] }
  assert.equal(identity.messages.length, 2)
})

test("POST / reports and retries a failed identity projection", async () => {
  const kv = createMemoryKv()
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const id = "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02"
  const operation = await createCreateOperation(id)
  const message = await signMessage({ raw: toRawOperation(operation) }, keyPair)
  const originalPut = kv.put.bind(kv)

  kv.put = async () => {
    throw new Error("KV unavailable")
  }
  const failedResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  kv.put = originalPut

  assert.equal(failedResponse.status, 500)

  const retryResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  assert.equal(retryResponse.status, 200)

  const identitiesResponse = await request(kv, "/identities")
  assert.equal(identitiesResponse.status, 200)
  const identities = (await identitiesResponse.json()) as { id: string }[]
  assert.deepEqual(
    identities.map(({ id }) => id),
    [id]
  )
})

test("GET /search/:term finds Items and Identities by id or body", async () => {
  const kv = createMemoryKv()
  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const identityId = "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02"
  const itemId = "Item-search-result"
  const identityCreate = await createCreateOperation(identityId)
  const itemCreate = await createCreateOperation(itemId)
  const messages = await Promise.all(
    [
      toRawOperation(identityCreate),
      `${identityId}\n${identityCreate.hash}\nSET\nbody\nShared Search Marker\n`,
      toRawOperation(itemCreate),
      `${itemId}\n${itemCreate.hash}\nSET\nbody\nShared Search Marker\n`
    ].map(raw => signMessage({ raw }, keyPair))
  )

  const createResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(createResponse.status, 200)

  const bodyResponse = await request(kv, "/search/search")
  assert.equal(bodyResponse.status, 200)
  const bodyMatches = (await bodyResponse.json()) as { id: string }[]
  assert.deepEqual(
    bodyMatches.map(({ id }) => id),
    [identityId, itemId]
  )
  assert.ok(bodyMatches.every(match => !("type" in match)))

  const itemIdResponse = await request(kv, `/search/${encodeURIComponent(itemId.toUpperCase())}`)
  const itemIdMatches = (await itemIdResponse.json()) as { id: string }[]
  assert.deepEqual(
    itemIdMatches.map(({ id }) => id),
    [itemId]
  )

  const identityIdResponse = await request(kv, `/search/${encodeURIComponent(identityId)}`)
  const identityIdMatches = (await identityIdResponse.json()) as { id: string }[]
  assert.deepEqual(
    identityIdMatches.map(({ id }) => id),
    [identityId]
  )

  const noMatchesResponse = await request(kv, "/search/no-such-entity")
  assert.deepEqual(await noMatchesResponse.json(), [])
})
