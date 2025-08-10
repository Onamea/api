import { getPublicKey } from "@noble/secp256k1"
import { primaryKeyToFingerprint, publicKeyToPrimaryKey, sign, verify } from "@vanice/types"

// deno-fmt-ignore
const privateKey = new Uint8Array([
   30,  38, 118, 159, 239, 195,  62,   6,
  205,   8, 202,  74, 142, 212, 251,  73,
   43,  66,  18, 129, 193, 124, 132, 145,
  200, 111,  59, 219, 159, 251,   3, 147
])

const publicKey = getPublicKey(privateKey)
const primaryKey = publicKeyToPrimaryKey(publicKey)
const name = "Vanic"

const signature = await sign(primaryKey, name, privateKey)
const isVerified = verify(primaryKey, name, signature)
console.assert(isVerified, "Signature verification failed")
const fingerprint = await primaryKeyToFingerprint(primaryKey)

console.log({
  name,
  primaryKey,
  fingerprint,
  signature
})
