import { fromPublicKeyDisplay, Identity } from "@vanice/types"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as Identity
    if (e.publicKeyDisplay !== undefined) continue
    const publicKeyDisplay = e.publicKey
    const publicKey = fromPublicKeyDisplay(e.publicKey)
    kv.set(entry.key, { ...e, publicKey, publicKeyDisplay })
  }
}