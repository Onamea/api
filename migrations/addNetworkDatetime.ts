import { ExtendedData } from "../lib/Data.ts"

const kv = await Deno.openKv()
const datetime = 1760018104194 

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const e = entry.value as unknown as ExtendedData
    if (!("network" in e) || e.network !== undefined) continue
    kv.set(entry.key, { ...e, network: { datetime } })
  }
}