import { createCreateOperation } from "@onamea/types"
import { ExtendedData } from "../lib/Data.ts"

const kv = await Deno.openKv()

export default async () => {
  const entries = kv.list({ prefix: ["vanice"] })
  for await (const entry of entries) {
    const { primaryKey, name } = entry.value as unknown as ExtendedData
    const createOperation = await createCreateOperation(primaryKey, name)
    console.log(entry.value, createOperation)
    //kv.set(entry.key, { ...e, primaryKey })
  }
}
