import { NameKey, nameKeyToFingerprintedName } from "@onamea/types"
import type { Identity } from "@onamea/crdt"

const kv = await Deno.openKv()

export default async () => {
  const identities = kv.list({ prefix: ["identities"] })
  for await (const entry of identities) {
    const identity = entry.value as { referents?: NameKey[] }
    if (typeof identity.referents?.[0] !== "string") continue
    const referents = await Promise.all((identity.referents ?? []).map(
      async (referent) => {
        const displayName = await nameKeyToFingerprintedName(referent as NameKey)
        return { id: referent, displayName }
      }
    ))
    const updatedIdentity = identity as Identity
    updatedIdentity.referents = referents
    kv.set(entry.key, updatedIdentity)
  }
}
