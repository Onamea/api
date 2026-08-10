import type { Fingerprint, FingerprintDisplay, Name, PrimaryKey, PrimaryName, Signature } from "@onamea/types"
import {
  displayFingerprint,
  readCryptoNameFromPrimaryKey,
  isAcceptedName,
  isNameOrFingerprintedName,
  isPrimaryKey,
  isSignature,
  primaryKeyToFingerprint,
  toPrimaryName,
  messageToHash,
  verify,
  primaryKeyToPublicKey,
} from "@onamea/types"
import isObject from "./utils/isObject.ts"

type Epoch = number

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
}

export type NetworkData = {
  network: {
    datetime: Epoch
  }
}

export type ExtendedNetworkData = ExtendedData & NetworkData

export const validateData = async (data: unknown): Promise<boolean> => {
  if (isObject(data)) {
    if (isPrimaryKey(data.primaryKey)) {
      const cryptoName = readCryptoNameFromPrimaryKey(data.primaryKey)
      if (isNameOrFingerprintedName(data.name)) {
        if (isAcceptedName(data.name)) {
          if (isSignature(cryptoName, data.signature)) {
            const hash = await messageToHash(data.name)
            const publicKey = primaryKeyToPublicKey(data.primaryKey)
            if (await verify(cryptoName, hash, data.signature, publicKey)) {
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
  const { primaryKey, name } = data
  const primaryName = toPrimaryName(name)
  const fingerprint = await primaryKeyToFingerprint(primaryKey)
  const fingerprintDisplay = displayFingerprint(fingerprint)
  return {
    ...data,
    primaryName,
    fingerprint,
    fingerprintDisplay
  }
}

export const extendWithNetworkData = (data: ExtendedData): ExtendedData & NetworkData => {
  return {
    ...data,
    network: {
      datetime: Date.now()
    }
  }
}
