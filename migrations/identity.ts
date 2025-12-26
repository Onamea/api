import { type Identity } from "@vanice/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity
    delete e.publicKey
    delete e.fingerprint
    kv.set(entry.key, e)
  }
}