import type { FingerprintDisplay, Name, NameKey, PrimaryKey, PrimaryName, Identity, Messages } from "@vanice/types"
import { fingerprintDisplayStartsWith, parseNameKey, toPrimaryName } from "@vanice/types"

const kv = await Deno.openKv()

type Key = ["vanice", PrimaryName, PrimaryKey]
export type Entry = Identity & { messages: Messages }
export type Entries = Entry[]

export const retrieveAll = async (): Promise<Entries> => {
  const entries = kv.list({ prefix: ["vanice"] })
  const values: Entries = []
  for await (const entry of entries) {
    values.push(entry.value as Entry)
  }
  // sort by primary key
  //values.sort((a, b) => a.key[2].localeCompare(b.key[2]))
  return values
}

export const retrieveByName = async (name: Name, fingerprintDisplay?: FingerprintDisplay): Promise<Entries> => {
  const primaryName = toPrimaryName(name)
  const entries = kv.list({ prefix: ["vanice", primaryName] })
  const values: Entries = []
  for await (const entry of entries) {
    const data = entry.value as Entry
    if (fingerprintDisplay === undefined || fingerprintDisplayStartsWith(data.fingerprintDisplay, fingerprintDisplay)) {
      values.push(data)
    }
  }
  return values
}

export const retrieveByNameKey = async (nameKey: NameKey): Promise<Entry | undefined> => {
  const [primaryKey, name] = parseNameKey(nameKey)
  const primaryName = toPrimaryName(name)
  const key: Key = ["vanice", primaryName, primaryKey]
  const result = await kv.get(key)
  if (result.value === null) return undefined
  return result.value as Entry
}

export const insert = async (data: Entry) => {
  const { name, primaryKey } = data
  const primaryName = toPrimaryName(name)
  const key: Key = ["vanice", primaryName, primaryKey]
  await kv.set(key, data)
}

export const remove = async (primaryName: PrimaryName, primaryKey: PrimaryKey) => {
  await kv.delete(["vanice", primaryName, primaryKey])
}
