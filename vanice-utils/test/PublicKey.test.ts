import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { primaryKeyToPublicKey, publicKeyToPrimaryKey } from "../PublicKey.ts"

Deno.test("PublicKey", () => {
  assertEquals(
    "M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4G3", 
    publicKeyToPrimaryKey(primaryKeyToPublicKey("M1KABKCN21R65CU8HB736HNYJG0G1UQC4XX2VCAJNPBKVRG3PF4G3"))
  )
  assertEquals(
    "M1KHFXMA73MGK843WAPMMR77DHPSUKQV1VGJCSUR9CKRT5RWUFS02",
    publicKeyToPrimaryKey(primaryKeyToPublicKey("M1KHFXMA73MGK843WAPMMR77DHPSUKQV1VGJCSUR9CKRT5RWUFS02"))
  )
})