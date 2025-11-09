import type { Fingerprint, Name, NameKey, PrimaryKey, PrimaryName, Identity } from "@vanice/types"
import { fingerprintStartsWithFingerprint, parseNameKey, toPrimaryName } from "@vanice/types"

const kv = await Deno.openKv()

type Key = ["vanice", PrimaryName, PrimaryKey]

export const retrieveAll = async (): Promise<Identity[]> => {
  const entries = kv.list({ prefix: ["vanice"] })
  const values: Identity[] = []
  for await (const entry of entries) {
    values.push(entry.value as Identity)
  }
  // sort by primary key
  //values.sort((a, b) => a.key[2].localeCompare(b.key[2]))
  return values
}

export const retrieveByName = async (name: Name, fingerprint: Fingerprint | undefined): Promise<Identity[]> => {
  const primaryName = toPrimaryName(name)
  const entries = kv.list({ prefix: ["vanice", primaryName] })
  const values: Identity[] = []
  for await (const entry of entries) {
    const data = entry.value as Identity
    if (fingerprint === undefined || fingerprintStartsWithFingerprint(data.fingerprint, fingerprint)) {
      values.push(data)
    }
  }
  return values
}

export const retrieveByNameKey = async (nameKey: NameKey): Promise<Identity | undefined> => {
  const [primaryKey, name] = parseNameKey(nameKey)
  const primaryName = toPrimaryName(name)
  const key: Key = ["vanice", primaryName, primaryKey]
  const result = await kv.get(key)
  if (result.value === null) return undefined
  return result.value as Identity
}

export const insert = async (data: Identity) => {
  const { name, primaryKey } = data
  const primaryName = toPrimaryName(name)
  const key: Key = ["vanice", primaryName, primaryKey]
  await kv.set(key, data)
}

export const remove = async (primaryName: PrimaryName, primaryKey: PrimaryKey) => {
  await kv.delete(["vanice", primaryName, primaryKey])
}
