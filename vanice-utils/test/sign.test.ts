import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { getPublicKey } from "npm:@noble/secp256k1@2.3.0"
import { sign, verify } from "../sign.ts"
import { publicKeyToPrimaryKey } from "../PublicKey.ts"

Deno.test("sign and verify roundtrip", async () => {

  // Test data
  const name = "XY0"
  const privateKey = new Uint8Array([
    228, 204, 24,   2, 214,   9, 156, 252,
    180,  69,  7, 125,  40,   6, 208, 146,
    120, 219,  5, 121, 122, 219, 230, 217,
    217, 200, 75, 158, 255, 172,  94,  76
  ])
  const publicKey = getPublicKey(privateKey)
  const primaryKey = publicKeyToPrimaryKey(publicKey)

  // Sign the data
  const signature = await sign(primaryKey, name, privateKey)
  
  // Verify the signature
  const isValid = verify(primaryKey, name, signature)
  assertEquals(isValid, true)

  // Verify fails with wrong name
  const isInvalid = verify(primaryKey, "john", signature)
  assertEquals(isInvalid, false)
})