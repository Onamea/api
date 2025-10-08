import type { Fingerprint, FingerprintDisplay, Name, PrimaryKey, PrimaryName, Signature } from "@vanice/types"
import {
  displayFingerprint,
  isAcceptedName,
  isNameOrFingerprintedName,
  isPrimaryKey,
  isSignature,
  primaryKeyToFingerprint,
  toPrimaryName,
  verify
} from "@vanice/types"
import isObject from "./utils/isObject.ts"

//type Epoch = number

export type Data = {
  primaryKey: PrimaryKey
  name: Name
  signature: Signature
  /*
  content?: string
  tombstone?: boolean
  */
}

export type ExtendedData = Data & {
  primaryName: PrimaryName
  fingerprint: Fingerprint
  fingerprintDisplay: FingerprintDisplay
  /*
  datetime: Epoch
  */
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
  const primaryName = toPrimaryName(name)
  const fingerprint = await primaryKeyToFingerprint(primaryKey)
  const fingerprintDisplay = displayFingerprint(fingerprint)
  return {
    primaryKey,
    name,
    primaryName,
    fingerprint,
    fingerprintDisplay,
    signature
  }
}
