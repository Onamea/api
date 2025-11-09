import { type Identity, buildFromOperations, isOperations } from "@vanice/types"
import isObject from "./utils/isObject.ts"
import me from "../config/me.json" with { type: "json" }

const operations = isObject(me) && "operations" in me ? me.operations : undefined
const identity = isOperations(operations) ? 
  await buildFromOperations(operations, me.operations[0].primaryKey, me.operations[0].name) :
  undefined

export default (): Identity | undefined => {
  return identity
}
