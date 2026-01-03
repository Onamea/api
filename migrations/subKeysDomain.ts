import { buildIdentityFromOperations, Identity } from "@vanice/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity
    const subKeys = (await buildIdentityFromOperations(e.operations, e.id)).subKeys
    kv.set(entry.key, { ...e, subKeys })
  }
}