import { 
  isName, 
  isPrimaryKey, 
  primaryKeyToPublicKey, 
  sign, 
  fromHex, 
  keyPairFromPrivateKey, 
  displayPublicKey, 
  messageToHash
} from "@vanice/types"

const name = Deno.args[0]
const primaryKey = Deno.args[1]
const privateKeyHex = Deno.args[2]

if (isName(name) === false) {
  console.error("Invalid name")
  Deno.exit(1)
}

if (isPrimaryKey(primaryKey) === false) {
  console.error("Invalid primary key")
  Deno.exit(1)
}

if (privateKeyHex === undefined) {
  console.error("Missing private key")
  Deno.exit(1)
}

const publicKey = primaryKeyToPublicKey(primaryKey)
const privateKey = fromHex(privateKeyHex)
const cryptoName = "ECDSA"
const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)

if (displayPublicKey(cryptoName, publicKey) !== displayPublicKey(cryptoName, keyPair.publicKey)) {
  console.error("Private key does not match primary key")
  Deno.exit(1)
}

const hash = await messageToHash(primaryKey)
const signature = await sign(cryptoName, hash, privateKey)

const data = { primaryKey, name, signature }

console.log(`
  curl -X POST \
  -H "Content-Type: application/json" \
  -d '${ JSON.stringify(data) }' \
  https://api.vanice.cloud/`)
