const kv = await Deno.openKv()

export default async () => {
  const identities = kv.list({ prefix: ["identities"] })
  for await (const entry of identities) {
    const identity = entry.value as { fingerprintedName?: string; displayName?: string }
    identity.displayName = identity.fingerprintedName
    delete identity.fingerprintedName
    kv.set(entry.key, identity)
  }
  const items = kv.list({ prefix: ["items"] })
  for await (const entry of items) {
    const item = entry.value as { id: string; displayName?: string }
    item.displayName = item.id
    kv.set(entry.key, item)
  }
}
