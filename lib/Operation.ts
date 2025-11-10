import type { SignedOperation, Signature, Identity, NameKey } from "@vanice/types"
import { verifyOperation, messageToHash, parseOperation, isHexString, createCreateOperation, parseNameKey, buildFromOperations } from "@vanice/types"
import isString from "./utils/isString.ts"
import isObject from "./utils/isObject.ts"

type IncomingOperation = {
  raw: string
  signature: Signature
}

export const isIncomingOperation = (obj: unknown): obj is IncomingOperation => {
  if (isObject(obj) === false) return false
  const { raw, signature } = obj as IncomingOperation
  return isString(raw) && isHexString(signature)
}

export const cleanIncomingOperation = (obj: IncomingOperation): IncomingOperation => {
  const { raw, signature } = obj
  return { raw, signature }
}

// parse
// validate
// verify
export const validateOperation = async (incomingOperation: IncomingOperation): Promise<SignedOperation> => {
  const { raw, signature } = incomingOperation
  const hash = await messageToHash(raw)
  const operation = await parseOperation(raw)
  const signedOperation = { ...operation, hash, signature }
  console.log(operation, signedOperation)
  const isVerified = await verifyOperation(signedOperation)
  if (isVerified === false) {
    throw new Error("Operation verification failed")
  }
  return signedOperation
}

export const isAcceptedOperation = (identity: Identity | undefined, operation: SignedOperation): boolean => {
  if (identity === undefined) {
    return operation.type === "CREATE"
  }
  return identity.operations.some(({ hash }) => hash === operation.hash) === false
}

export const buildFromNameKey = async (nameKey: NameKey): Promise<Identity> => {
  const [primaryKey, name] = parseNameKey(nameKey)
  const createOperation = await createCreateOperation(name, primaryKey)
  return await buildFromOperations([createOperation], primaryKey, name)
}