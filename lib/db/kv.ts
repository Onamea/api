import { type PrimaryKey, type PrimaryName, type Name, type Fingerprint, toPrimaryChars } from "@vanice/types"
import type { ExtendedData } from "../Data.ts"

const kv = await Deno.openKv()

type Key = ["vanice", PrimaryName, PrimaryKey]
export type KVData = {
  key: Key,
  value: ExtendedData
}

export const retrieveAll = async (): Promise<KVData[]> => {
  const entries = kv.list({ prefix: ["vanice"] })
  const values: KVData[] = []
  for await (const entry of entries) {
    values.push(entry as unknown as KVData)
  }
  // sort by primary key
  values.sort((a, b) => a.key[2].localeCompare(b.key[2]))
  return values
}

export const retrieveByName = async (name: Name, fingerprint: Fingerprint | undefined): Promise<ExtendedData[]> => {
  const primaryName = toPrimaryChars(name)
  const entries = kv.list({ prefix: ["vanice", primaryName] })
  const values: ExtendedData[] = []
  for await (const entry of entries) {
    const data = entry.value as ExtendedData
    if (fingerprint === undefined || data.fingerprint.startsWith(fingerprint)) {
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

/*
export const remove = async (primaryKey: PrimaryKey) => {

}
*/
