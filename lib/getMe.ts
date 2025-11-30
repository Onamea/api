import { type Identity, type NameKey, buildIdentityFromOperations, isMessage, parseRawOperation } from "@vanice/types"
import message from "../config/me.json" with { type: "json" }

let identity: Identity | undefined

if (isMessage(message)) {
  try {
    const operations = [await parseRawOperation(message.raw)]
    const nameKey = operations[0].id
    identity = await buildIdentityFromOperations(operations, nameKey as NameKey) 
  } catch (error) {
    console.error("Failed to build identity from config/me.json: ", error)
  }
}

export default (): Identity | undefined => {
  return identity
}
