import type { FingerprintDisplay, Name, NameKey } from "@onamea/types"
import { fingerprintDisplayStartsWith, nameKeyToFingerprintDisplay, parseNameKey } from "@onamea/types"
import type { Id, Identity, Item, Messages } from "@onamea/crdt"
import { isId } from "@onamea/crdt"

const kv = await Deno.openKv()

type Key = ["identities", Name, NameKey]
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
  const [, name] = parseNameKey(id)
  const key: Key = ["identities", name, id]
  const result = await kv.get(key)
  if (result.value === null) return undefined
  return result.value as IdentityWithMessages
}

export const retrieveByName = async (
  name: Name,
  fingerprintDisplaySuffix?: FingerprintDisplay
): Promise<IdentityWithMessages[]> => {
  const entries = kv.list({ prefix: ["identities", name] })
  const values: IdentityWithMessages[] = []
  for await (const entry of entries) {
    const data = entry.value as IdentityWithMessages
    const fingerprintDisplay = await nameKeyToFingerprintDisplay(data.id)
    if (
      fingerprintDisplaySuffix === undefined ||
      fingerprintDisplayStartsWith(fingerprintDisplay, fingerprintDisplaySuffix)
    ) {
      values.push(data)
    }
  }
  return values
}

export const insert = async (identity: IdentityWithMessages) => {
  const [, name] = parseNameKey(identity.id)
  const key: Key = ["identities", name, identity.id]
  await kv.set(key, identity)
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
