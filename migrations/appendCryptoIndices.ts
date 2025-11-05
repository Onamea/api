import { ExtendedData } from "../lib/Data.ts"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as ExtendedData
    if (e.primaryKey.slice(-1) === "1") continue
    const primaryKey = e.primaryKey + "1"
    kv.set(entry.key, { ...e, primaryKey })
  }
}