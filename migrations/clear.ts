const kv = await Deno.openKv()

export default async () => {
  const identities = kv.list({ prefix: ["identities"] })
  for await (const entry of identities) {
    kv.delete(entry.key)
  }
  const items = kv.list({ prefix: ["items"] })
  for await (const entry of items) {
    kv.delete(entry.key)
  }
}
