const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const newKey = entry.key as [string, string, string]
    newKey[0] = "identities"
    kv.set(newKey, entry.value)
    kv.delete(entry.key)
  }
}