import { Identity } from "@vanice/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity & { nameKey?: string }
    if (e.id !== undefined) continue
    const id = e.nameKey
    delete e.nameKey
    kv.set(entry.key, { ...e, id })
  }
}