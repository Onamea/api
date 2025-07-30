import isObject from "./utils/isObject.ts"
import { type PrimaryKey, type Name, isAcceptedName, isPrimaryKey, isNameOrFingerprintedName, Fingerprint, primaryKeyToFingerprint, PrimaryChars, toPrimaryChars } from "../vanice-utils/PrimaryKey.ts"
import { isSignature, type Signature, verify } from "../vanice-utils/sign.ts"

//type Epoch = number

export type Data = {
  primaryKey: PrimaryKey
  name: Name
  signature: Signature
  /*
  content?: string
  tombstone?: boolean
  datetime: Epoch
  */
}

export type ExtendedData = Data & {
  primaryName: PrimaryChars
  fingerprint: Fingerprint
}

export const validateData = (data: unknown): data is Data => {
  if (isObject(data)) {
    if (isPrimaryKey(data.primaryKey)) {
      if (isNameOrFingerprintedName(data.name)) {
        if (isAcceptedName(data.name)) {
          if (isSignature(data.signature)) {
            if (verify(data.primaryKey, data.name, data.signature)) {
              return true
            }
          }
        }
      }
    }
  }
  return false
}

export const extendData = async (data: Data): Promise<ExtendedData> => {
  const { primaryKey, name, signature } = data
  const primaryName = toPrimaryChars(name)
  const fingerprint = await primaryKeyToFingerprint(primaryKey)
  return {
    primaryKey,
    name,
    primaryName,
    fingerprint,
    signature
  }
}