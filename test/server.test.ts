import { test } from "node:test"
import assert from "node:assert/strict"
import { isNameKey, keyPairFromPrivateKey } from "@onamea/types"
import {
  createCreateOperation,
  createSetOperation,
  signMessage,
  toRawOperation,
  isSignedByOwner,
  parseRawOperation
} from "@onamea/crdt"
import type { Message } from "@onamea/crdt"
import app from "../app.ts"
import type { WorkersKVNamespace } from "../lib/db/workersKv.ts"
import type { AppendResult, OperationStoreNamespace, StoredOperationMessage } from "../lib/db/operationStore.ts"
import meMessage from "../config/me.json" with { type: "json" }
import { cryptoName, privateKey } from "./data.mock.ts"

const operationStores = new WeakMap<WorkersKVNamespace, OperationStoreNamespace>()

const createMemoryOperationStore = (): OperationStoreNamespace => {
  const names = new WeakMap<object, string>()
  const entities = new Map<string, Message[]>()
  const pendingWrites = new Map<string, Promise<void>>()
  const toRecords = async (messages: Message[]): Promise<StoredOperationMessage[]> =>
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
  return {
    idFromName: name => {
      const id = {}
      names.set(id, name)
      return id
    },
    get: id => ({
      getMessages: async () => [...(entities.get(names.get(id as object)!) ?? [])],
      append: async (incoming: Message[]): Promise<AppendResult> => {
        const entityId = names.get(id as object)!
        const incomingRecords = await toRecords(incoming)
        const previousWrite = pendingWrites.get(entityId) ?? Promise.resolve()
        let releaseWrite!: () => void
        const currentWrite = new Promise<void>(resolve => (releaseWrite = resolve))
        pendingWrites.set(entityId, currentWrite)
        await previousWrite
        try {
          const existing = await toRecords(entities.get(entityId) ?? [])
          const wasIdentity = existing.some(
            ({ operation, isOwnerSigned }) => isOwnerSigned && operation.type === "CREATE"
          )
          const existingMessageKeys = new Set(
            existing.map(({ operation, message }) =>
              JSON.stringify([operation.hash, message.cryptoName, message.publicKey, message.signature])
            )
          )
          const added = incomingRecords.filter(({ operation, message }) => {
            const key = JSON.stringify([operation.hash, message.cryptoName, message.publicKey, message.signature])
            if (existingMessageKeys.has(key)) return false
            existingMessageKeys.add(key)
            return true
          })
          const records = [...existing, ...added]
          entities.set(
            entityId,
            records.map(({ message }) => message)
          )
          const isIdentity = records.some(
            ({ operation, isOwnerSigned }) => isOwnerSigned && operation.type === "CREATE"
          )
          return { records, added, isIdentity, becameIdentity: isIdentity && !wasIdentity }
        } finally {
          releaseWrite()
          if (pendingWrites.get(entityId) === currentWrite) pendingWrites.delete(entityId)
        }
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

test("GET /me includes its messages", async () => {
  const kv = createMemoryKv()
  const postResponse = await request(kv, "/", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(meMessage)
  })
  assert.equal(postResponse.status, 200)

  const response = await request(kv, "/me")
  assert.equal(response.status, 200)
  const body = (await response.json()) as { messages: unknown[] }
  assert.equal(body.messages.length, 1)
})

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
  const item = (await itemResponse.json()) as { id: string; messages: unknown[] }
  assert.equal(item.id, "Item-1")
  assert.equal(item.messages.length, 1)
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

  const nameResponse = await request(kv, "/identities/name/Vani")
  assert.equal(nameResponse.status, 200)
  const identitiesByName = (await nameResponse.json()) as { id: string; messages: unknown[] }[]
  assert.deepEqual(
    identitiesByName.map(({ id }) => id),
    [id]
  )
  assert.equal(identitiesByName[0].messages.length, 2)

  const projectionKeys = await kv.list({ prefix: "entity-projections/", limit: 1000 })
  assert.equal(projectionKeys.keys.length, 1)
  const projections = await Promise.all(
    projectionKeys.keys.map(
      async ({ name }) =>
        (await kv.get(name, "json")) as { isIdentity: boolean; entity: { id: string; messages?: unknown[] } }
    )
  )
  assert.ok(projections.some(projection => projection.isIdentity && projection.entity.id === id))
  assert.ok(projections.every(projection => !("messages" in projection.entity)))
  assert.equal((await kv.list({ prefix: "identity-index/", limit: 1000 })).keys.length, 1)
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

  const oversizedResponse = await request(kv, `/search/${"x".repeat(257)}`)
  assert.equal(oversizedResponse.status, 400)
  assert.deepEqual(await oversizedResponse.json(), { error: "Search term must be 256 characters or fewer" })
})
