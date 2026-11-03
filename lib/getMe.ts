import type { NameKey } from "@onamea/types"
import { type IdentityWithMessages, type Messages, buildIdentityFromOperations, isMessage, parseRawOperation } from "@onamea/crdt"
import messages from "../config/me.json" with { type: "json" }

let identity: IdentityWithMessages | undefined

const isMessages = (value: unknown): value is Messages =>
  Array.isArray(value) && value.length > 0 && value.every(isMessage)

if (isMessages(messages)) {
  try {
    const operations = await Promise.all(messages.map(async message => await parseRawOperation(message.raw)))
    const nameKey = operations[0].id
    identity = {
      ...(await buildIdentityFromOperations(operations, nameKey as NameKey)),
      messages
    }
  } catch (error) {
    console.error("Failed to build identity from config/me.json: ", error)
  }
}

export default (): IdentityWithMessages | undefined => {
  return identity
}
