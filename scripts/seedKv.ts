import { extendData } from "../lib/Data.ts"

// TODO: Read from mock.data.ts
const entries = [
  {
    primaryKey: "M1KE223H63CE2NT05JWUVSVD7FSD1B9UQ74CUSQQ7XPQDPNA0QPG3",
    name: "Mike",
    signature:
      "fc9c2a43710b4b8d8d7803ee9e24fbcc0499aa196c1871d7c913d2bae5dc11ea3f5e6b33e7858a6cb806863151f00e84aee1c6f618f16fa218db4edcea436e79"
  },
  {
    primaryKey: "M1CQE1WPR4RBSP6MNB1R4UEVMV34AW3677653XMMNDPAXE87QDP03",
    name: "Mic",
    signature:
      "9789f25391c01e5f5d6e4fe46beb1f2d88cac2e7da54d8becac9e48d4b5acf3c0fa6fea8ff4b92c7b4df15ff28b8f6cfee164e3ccc6c674ed616a9cecfd2b0ec"
  }
]

const kv = await Deno.openKv()

for await (const entry of entries) {
  const data = await extendData(entry)
  const key = ["vanice", data.primaryName, data.primaryKey]
  await kv.set(key, data)
}

kv.close()
