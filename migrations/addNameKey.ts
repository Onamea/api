import { Identity, toNameKey } from "@vanice/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity
    if (e.nameKey !== undefined) continue
    const nameKey = toNameKey(e.name, e.primaryKey)
    kv.set(entry.key, { ...e, nameKey })
  }
}