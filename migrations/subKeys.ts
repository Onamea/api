import { Identity } from "@onamea/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity
    if (e.subKeys !== undefined) continue
    kv.set(entry.key, { ...e, subKeys: [] })
  }
}
