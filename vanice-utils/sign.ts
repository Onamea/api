import { signAsync, verify as secpVerify } from "npm:@noble/secp256k1@2.3.0"
import { sha256 } from "npm:@noble/hashes/sha2"
import { utf8ToBytes, hexToBytes } from "npm:@noble/hashes/utils"
import { type Name, type PrimaryKey } from "./PrimaryKey.ts"
import { primaryKeyToPublicKey } from "./PublicKey.ts"
import isString from "../lib/utils/isString.ts"

export type Signature = string

export const isSignature = (value: unknown): value is Signature => {
  return isString(value) && value.length === 128 && /^[0-9a-f]{128}$/.test(value)
}

const serialize = (primaryKey: PrimaryKey, name: Name) : string => {
  const delimiter = "|"
  return [
    primaryKey,
    name
  ].join(delimiter)
}

const hash = (primaryKey: PrimaryKey, name: Name) => {
  return sha256(utf8ToBytes(serialize(primaryKey, name)))
}

export const sign = async (primaryKey: PrimaryKey, name: Name, privateKey: Uint8Array) : Promise<Signature> => {
  const messageHash = hash(primaryKey, name)
  const signature = await signAsync(messageHash, privateKey)
  return signature.toCompactHex()
}

export const verify = (primaryKey: PrimaryKey, name: Name, signature: Signature): boolean => {
  const messageHash = hash(primaryKey, name)
  return secpVerify(
    hexToBytes(signature),
    messageHash, 
    primaryKeyToPublicKey(primaryKey)
  )
}