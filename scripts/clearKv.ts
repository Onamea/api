const kv = await Deno.openKv()
const entries = kv.list({ prefix: [] })
for await (const entry of entries) {
  await kv.delete(entry.key)
}
console.log("KV database cleared")
kv.close()
