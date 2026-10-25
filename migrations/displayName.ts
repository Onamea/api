import { type NameKey, nameKeyToFingerprintedName } from "@onamea/types"

const kv = await Deno.openKv()

export default async () => {
  const identities = kv.list({ prefix: ["identities"] })
  for await (const entry of identities) {
    const identity = entry.value as { id: NameKey; displayName?: string }
    identity.displayName = await nameKeyToFingerprintedName(identity.id)
    kv.set(entry.key, identity)
  }
  const items = kv.list({ prefix: ["items"] })
  for await (const entry of items) {
    const item = entry.value as { id: string; displayName?: string }
    item.displayName = item.id
    kv.set(entry.key, item)
  }
}
