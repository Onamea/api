import type { Fingerprint, Name, PrimaryKey, PrimaryName } from "@vanice/types"
import { fingerprintStartsWithFingerprint, toPrimaryName } from "@vanice/types"
import type { ExtendedData } from "../Data.ts"

const kv = await Deno.openKv()

type Key = ["vanice", PrimaryName, PrimaryKey]

export const retrieveAll = async (): Promise<ExtendedData[]> => {
  const entries = kv.list({ prefix: ["vanice"] })
  const values: ExtendedData[] = []
  for await (const entry of entries) {
    values.push(entry.value as ExtendedData)
  }
  // sort by primary key
  //values.sort((a, b) => a.key[2].localeCompare(b.key[2]))
  return values
}

export const retrieveByName = async (name: Name, fingerprint: Fingerprint | undefined): Promise<ExtendedData[]> => {
  const primaryName = toPrimaryName(name)
  const entries = kv.list({ prefix: ["vanice", primaryName] })
  const values: ExtendedData[] = []
  for await (const entry of entries) {
    const data = entry.value as ExtendedData
    if (fingerprint === undefined || fingerprintStartsWithFingerprint(data.fingerprint, fingerprint)) {
      values.push(data)
    }
  }
  return values
}

export const insert = async (data: ExtendedData) => {
  const { primaryName, primaryKey } = data
  const key: Key = ["vanice", primaryName, primaryKey]
  await kv.set(key, data)
}

export const remove = async (primaryName: PrimaryName, primaryKey: PrimaryKey) => {
  await kv.delete(["vanice", primaryName, primaryKey])
}
