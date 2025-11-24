import type { SignedOperation, Identity, NameKey, Operation, Operations, SignatureDisplay } from "@vanice/types"
import { verifyOperation, messageToHash, parseOperation, isHexString, createCreateOperation, parseNameKey, buildFromOperations } from "@vanice/types"
import isString from "./utils/isString.ts"
import isObject from "./utils/isObject.ts"

type IncomingOperation = {
  raw: string
  signature: SignatureDisplay
}

export const isIncomingOperation = (obj: unknown): obj is IncomingOperation => {
  if (isObject(obj) === false) return false
  const { raw, signature } = obj
  return isString(raw) && isHexString(signature)
}

export const areIncomingOperations = (arr: unknown[]): arr is IncomingOperation[] => {
  return arr.every(isIncomingOperation)
}

export const cleanIncomingOperation = (obj: IncomingOperation): IncomingOperation => {
  const { raw, signature } = obj
  return { raw, signature }
}

export const groupOperationsById = (operations: Operations): Record<NameKey, Operations> => {
  return operations.reduce((acc, operation) => {
    const { id } = operation
    if (acc[id] === undefined) {
      acc[id] = []
    }
    acc[id].push(operation)
    return acc
  }, {} as Record<NameKey, Operations>)
}

// parse
// validate
// verify
export const validateOperation = async (incomingOperation: IncomingOperation): Promise<SignedOperation> => {
  const { raw, signature } = incomingOperation
  const hash = await messageToHash(raw)
  const operation = await parseOperation(raw)
  const signedOperation = { ...operation, hash, signature }
  const isVerified = await verifyOperation(signedOperation)
  if (isVerified === false) {
    throw new Error("Operation verification failed")
  }
  return signedOperation
}

export const validateOperations = async (incomingOperations: IncomingOperation[]): Promise<SignedOperation[]> => {
  const validatedOperations: SignedOperation[] = []
  for (const incomingOperation of incomingOperations) {
    const signedOperation = await validateOperation(incomingOperation)
    validatedOperations.push(signedOperation)
  }
  return validatedOperations
}

export const isAcceptedOperation = (identity: Identity | undefined, operation: Operation): boolean => {
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