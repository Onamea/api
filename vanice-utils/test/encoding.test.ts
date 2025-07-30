import { assertEquals } from "https://deno.land/std@0.203.0/assert/mod.ts"
import { encode, decode } from "../encoding.ts"

Deno.test("encoding roundtrip", () => {
  const original = new Uint8Array(32).fill(1)
  const encoded = encode(original)
  const decoded = decode(encoded)
  assertEquals(decoded, original)
})

Deno.test("roundtrip PrimaryKey", () => {
  const primaryKey = "N22N2S8HVG7VRP8C3QVNDGR7H6SU0XAU7P0CF2JASMDN87C9VS10"
  const decoded = decode(primaryKey)
  const encoded = encode(decoded)
  assertEquals(encoded, primaryKey)
})