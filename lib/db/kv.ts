import type { FingerprintDisplay, Name, NameKey, PrimaryKey, PrimaryName, Identity, Messages, Item, Id } from "@vanice/types"
import { fingerprintDisplayStartsWith, isId, parseNameKey, toPrimaryName } from "@vanice/types"

const kv = await Deno.openKv()

type Key = ["identities", PrimaryName, PrimaryKey]
export type IdentityWithMessages = Identity & { messages: Messages }

type ItemKey = ["items", Id]
export type ItemWithMessages = Item & { messages: Messages }


export const retrieveAll = async (): Promise<IdentityWithMessages[]> => {
  const entries = kv.list({ prefix: ["identities"] })
  const values: IdentityWithMessages[] = []
  for await (const entry of entries) {
    values.push(entry.value as IdentityWithMessages)
  }
  // sort by primary key
  //values.sort((a, b) => a.key[2].localeCompare(b.key[2]))
  return values
}

export const retrieveById = async (id: NameKey): Promise<IdentityWithMessages | undefined> => {
  const [primaryKey, name] = parseNameKey(id)
  const primaryName = toPrimaryName(name)
  const key: Key = ["identities", primaryName, primaryKey]
  const result = await kv.get(key)
  if (result.value === null) return undefined
  return result.value as IdentityWithMessages
}

export const retrieveByName = async (name: Name, fingerprintDisplay?: FingerprintDisplay): Promise<IdentityWithMessages[]> => {
  const primaryName = toPrimaryName(name)
  const entries = kv.list({ prefix: ["identities", primaryName] })
  const values: IdentityWithMessages[] = []
  for await (const entry of entries) {
    const data = entry.value as IdentityWithMessages
    if (fingerprintDisplay === undefined || fingerprintDisplayStartsWith(data.fingerprintDisplay, fingerprintDisplay)) {
      values.push(data)
    }
  }
  return values
}

export const insert = async (data: IdentityWithMessages) => {
  const { name, primaryKey } = data
  const primaryName = toPrimaryName(name)
  const key: Key = ["identities", primaryName, primaryKey]
  await kv.set(key, data)
}

export const retrieveItemById = async (id: Id): Promise<ItemWithMessages | undefined> => {
  if (isId(id) === false) {
    throw new Error("Invalid Id")
  }
  const key: ItemKey = ["items", id]
  const result = await kv.get(key)
  if (result.value === null) return undefined
  return result.value as ItemWithMessages
}

export const insertItem = async (item: ItemWithMessages) => {
  const key: ItemKey = ["items", item.id]
  await kv.set(key, item)
}