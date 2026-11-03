import { createHash } from "node:crypto"
import type { FingerprintDisplay, Name, NameKey } from "@onamea/types"
import { fingerprintDisplayStartsWith, isNameKey, nameKeyToFingerprintDisplay, parseNameKey } from "@onamea/types"
import type { Id, IdentityWithMessages, ItemWithMessages } from "@onamea/crdt"
import { buildIdentityFromOperations, buildItemFromOperations, isId } from "@onamea/crdt"
import type { KVNamespace } from "@cloudflare/workers-types"
import type { StoredOperationMessage } from "./operationStore.ts"

export type WorkersKVNamespace = KVNamespace

export type SearchResult = IdentityWithMessages | ItemWithMessages

const IDENTITY_PREFIX = "identities/"
const ENTITY_PREFIX = "entities/"
const PAGE_SIZE = 1000

const hash = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex")

const identityPrefix = (name: Name, id: NameKey): string => `${IDENTITY_PREFIX}${hash(name)}/${hash(id)}/`

const entityPrefix = (id: Id): string => `${ENTITY_PREFIX}${hash(id)}/`

const messageKey = ({ operation, message }: StoredOperationMessage): string =>
  hash(JSON.stringify([operation.hash, message.cryptoName, message.publicKey, message.signature]))

const listValues = async <T>(kv: WorkersKVNamespace, prefix: string): Promise<T[]> => {
  const values: T[] = []
  let cursor: string | undefined

  do {
    const page = await kv.list({ prefix, limit: PAGE_SIZE, ...(cursor ? { cursor } : {}) })
    const pageValues = await Promise.all(page.keys.map(({ name }) => kv.get(name, "json")))
    for (const value of pageValues) {
      if (value !== null) values.push(value as T)
    }
    cursor = page.list_complete ? undefined : page.cursor
    if (!page.list_complete && cursor === undefined) {
      throw new Error("Workers KV list response is missing a cursor")
    }
  } while (cursor !== undefined)

  return values
}

const buildIdentities = async (records: StoredOperationMessage[]): Promise<IdentityWithMessages[]> => {
  const grouped = new Map<NameKey, StoredOperationMessage[]>()
  for (const record of records) {
    const id = record.operation.id
    if (isNameKey(id) === false) continue
    const messages = grouped.get(id) ?? []
    messages.push(record)
    grouped.set(id, messages)
  }

  return await Promise.all(
    [...grouped].map(async ([id, messages]) => ({
      ...(await buildIdentityFromOperations(
        messages.map(({ operation }) => operation),
        id,
        true
      )),
      messages: messages.map(({ message }) => message)
    }))
  )
}

export const createWorkersKv = (kv: WorkersKVNamespace) => ({
  listIdentities: async (): Promise<IdentityWithMessages[]> =>
    await buildIdentities(await listValues<StoredOperationMessage>(kv, IDENTITY_PREFIX)),

  getIdentityById: async (id: NameKey): Promise<IdentityWithMessages | undefined> => {
    const [, name] = parseNameKey(id)
    const records = await listValues<StoredOperationMessage>(kv, identityPrefix(name, id))
    return (await buildIdentities(records))[0]
  },

  findIdentitiesByName: async (
    name: Name,
    fingerprintDisplaySuffix?: FingerprintDisplay
  ): Promise<IdentityWithMessages[]> => {
    const identities = await buildIdentities(
      await listValues<StoredOperationMessage>(kv, `${IDENTITY_PREFIX}${hash(name)}/`)
    )
    if (fingerprintDisplaySuffix === undefined) return identities

    const matching: IdentityWithMessages[] = []
    for (const identity of identities) {
      const fingerprintDisplay = await nameKeyToFingerprintDisplay(identity.id)
      if (fingerprintDisplayStartsWith(fingerprintDisplay, fingerprintDisplaySuffix)) {
        matching.push(identity)
      }
    }
    return matching
  },

  search: async (term: string): Promise<SearchResult[]> => {
    const normalizedTerm = term.toLowerCase()
    const identities = await buildIdentities(await listValues<StoredOperationMessage>(kv, IDENTITY_PREFIX))
    const identityIds = new Set<string>(identities.map(({ id }) => id))
    const records = await listValues<StoredOperationMessage>(kv, ENTITY_PREFIX)
    const grouped = new Map<Id, StoredOperationMessage[]>()
    for (const record of records) {
      const entityRecords = grouped.get(record.operation.id) ?? []
      entityRecords.push(record)
      grouped.set(record.operation.id, entityRecords)
    }

    const matchingIdentities = identities.filter(
      ({ id, body }) =>
        id.toLowerCase().includes(normalizedTerm) || body?.toLowerCase().includes(normalizedTerm) === true
    )

    const matchingItems = await Promise.all(
      [...grouped]
        .filter(([id]) => !identityIds.has(id) && isId(id))
        .map(async ([id, entityRecords]) => {
          const item = {
            ...(await buildItemFromOperations(
              entityRecords.map(({ operation }) => operation),
              id
            )),
            messages: entityRecords.map(({ message }) => message)
          }
          return item.id.toLowerCase().includes(normalizedTerm) ||
            item.body?.toLowerCase().includes(normalizedTerm) === true
            ? item
            : undefined
        })
    )

    return [...matchingIdentities, ...matchingItems.filter(item => item !== undefined)]
  },

  getItemById: async (id: Id): Promise<ItemWithMessages | undefined> => {
    if (isId(id) === false) {
      throw new Error("Invalid Id")
    }
    const records = await listValues<StoredOperationMessage>(kv, entityPrefix(id))
    if (records.length === 0) return undefined
    return {
      ...(await buildItemFromOperations(
        records.map(({ operation }) => operation),
        id
      )),
      messages: records.map(({ message }) => message)
    }
  },

  appendEntityMessages: async (
    id: Id,
    records: StoredOperationMessage[],
    identityRecords: StoredOperationMessage[] = []
  ): Promise<void> => {
    const entityRecordsPrefix = entityPrefix(id)
    let identityRecordsPrefix: string | undefined
    if (identityRecords.length > 0 && isNameKey(id)) {
      const [, name] = parseNameKey(id)
      identityRecordsPrefix = identityPrefix(name, id)
    }

    const writes = records.map(record => kv.put(`${entityRecordsPrefix}${messageKey(record)}`, JSON.stringify(record)))

    if (identityRecordsPrefix !== undefined) {
      writes.push(
        ...identityRecords.map(record =>
          kv.put(`${identityRecordsPrefix}${messageKey(record)}`, JSON.stringify(record))
        )
      )
    }

    await Promise.all(writes)
  }
})
