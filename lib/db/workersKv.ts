import { createHash } from "node:crypto"
import type { FingerprintDisplay, Name, NameKey } from "@onamea/types"
import { fingerprintDisplayStartsWith, nameKeyToFingerprintDisplay, parseNameKey } from "@onamea/types"
import type { Id, Identity, Item, Message, MessageId } from "@onamea/crdt"
import { buildItemFromOperations, getMessageId, isId } from "@onamea/crdt"
import type { KVNamespace } from "@cloudflare/workers-types"

export type WorkersKVNamespace = KVNamespace

export type EntityProjection = { isIdentity: true; entity: Identity } | { isIdentity: false; entity: Item }

const IDENTITY_INDEX_PREFIX = "identity-index/"
const ENTITY_PROJECTION_PREFIX = "entity-projections/"
const MESSAGE_INDEX_PREFIX = "message-index/"
const PAGE_SIZE = 1000

const hash = (value: string): string => createHash("sha256").update(value, "utf8").digest("hex")

const identityIndexPrefix = (name?: Name): string =>
  name === undefined ? IDENTITY_INDEX_PREFIX : `${IDENTITY_INDEX_PREFIX}${hash(name)}/`

const identityIndexKey = (name: Name, id: NameKey): string => `${identityIndexPrefix(name)}${hash(id)}`

const entityProjectionKey = (id: Id): string => `${ENTITY_PROJECTION_PREFIX}${hash(id)}`
const messageIndexKey = (id: MessageId): string => `${MESSAGE_INDEX_PREFIX}${id}`

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

export const createWorkersKv = (kv: WorkersKVNamespace) => {
  const readProjection = async (id: Id): Promise<EntityProjection | undefined> =>
    (await kv.get<EntityProjection>(entityProjectionKey(id), "json")) ?? undefined

  const writeProjection = async (id: Id, projection: EntityProjection): Promise<void> => {
    await kv.put(entityProjectionKey(id), JSON.stringify(projection))
    if (projection.isIdentity) {
      const [, name] = parseNameKey(projection.entity.id)
      await kv.put(identityIndexKey(name, projection.entity.id), JSON.stringify(projection.entity.id))
    }
  }

  const getProjectionByIdentityIds = async (ids: NameKey[]): Promise<Identity[]> => {
    const projections = await Promise.all(ids.map(async id => await readProjection(id)))
    return projections.flatMap(projection => (projection?.isIdentity === true ? [projection.entity] : []))
  }

  const getProjectionByName = async (name: Name): Promise<Identity[]> => {
    const ids = await listValues<NameKey>(kv, identityIndexPrefix(name))
    return await getProjectionByIdentityIds(ids)
  }

  return {
    projectEntity: writeProjection,

    indexMessages: async (id: Id, messages: Message[]): Promise<void> => {
      await Promise.all(
        messages.map(async message => {
          const messageId = await getMessageId(message)
          await kv.put(messageIndexKey(messageId), id)
        })
      )
    },

    getEntityIdByMessageId: async (id: MessageId): Promise<Id | undefined> =>
      (await kv.get(messageIndexKey(id), "text")) ?? undefined,

    listEntityProjections: async (): Promise<EntityProjection[]> =>
      await listValues<EntityProjection>(kv, ENTITY_PROJECTION_PREFIX),

    listIdentities: async (): Promise<Identity[]> => {
      const ids = await listValues<NameKey>(kv, identityIndexPrefix())
      return await getProjectionByIdentityIds(ids)
    },

    getIdentityById: async (id: NameKey): Promise<Identity | undefined> => {
      const projection = await readProjection(id)
      return projection?.isIdentity === true ? projection.entity : undefined
    },

    findIdentitiesByName: async (name: Name, fingerprintDisplaySuffix?: FingerprintDisplay): Promise<Identity[]> => {
      const identities = await getProjectionByName(name)
      if (fingerprintDisplaySuffix === undefined) return identities

      const matching: Identity[] = []
      for (const identity of identities) {
        const fingerprintDisplay = await nameKeyToFingerprintDisplay(identity.id)
        if (fingerprintDisplayStartsWith(fingerprintDisplay, fingerprintDisplaySuffix)) {
          matching.push(identity)
        }
      }
      return matching
    },

    search: async (term: string): Promise<EntityProjection[]> => {
      const normalizedTerm = term.toLowerCase()
      const projections = await listValues<EntityProjection>(kv, ENTITY_PROJECTION_PREFIX)
      return projections.filter(
        ({ entity }) =>
          entity.id.toLowerCase().includes(normalizedTerm) ||
          entity.body?.toLowerCase().includes(normalizedTerm) === true
      )
    },

    getItemById: async (id: Id): Promise<Item | undefined> => {
      if (isId(id) === false) throw new Error("Invalid Id")
      const projection = await readProjection(id)
      if (projection !== undefined) {
        return projection.isIdentity
          ? await buildItemFromOperations(projection.entity.operations, id)
          : projection.entity
      }
      return undefined
    }
  }
}
