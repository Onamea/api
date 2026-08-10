import { assert, assertEquals } from "@std/assert"
import { createCreateOperation, keyPairFromPrivateKey, signMessage, toRawOperation } from "@onamea/types"
import { cryptoName, privateKey } from "./data.mock.ts"

const BASE_URL = "http://localhost:8000"

let serverProcess: Deno.ChildProcess | undefined

async function startServer() {
  serverProcess = new Deno.Command("deno", {
    args: [
      "run",
      "--allow-net",
      "--allow-env",
      "--allow-run",
      "--unstable-kv",
      "server.ts"
    ],
    stdout: "piped",
    stderr: "piped"
  }).spawn()
  // Poll until server responds or timeout after 2 seconds
  const maxAttempts = 20
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const response = await fetch(`${BASE_URL}/me`)
      if (response.ok || response.status === 404) {
        await response.body?.cancel()
        return
      }
      await response.body?.cancel()
    } catch {
      // ignore errors
    }
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  // Print server output for debugging
  if (serverProcess) {
    const { stdout: rawStdout, stderr: rawStderr } = await serverProcess.output()
    if (rawStdout) {
      console.log(new TextDecoder().decode(rawStdout))
    }
    if (rawStderr) {
      console.error(new TextDecoder().decode(rawStderr))
    }
    try {
      serverProcess.kill("SIGTERM")
    } catch {
      // ignore errors when killing the process
    }
    await serverProcess.status.catch(() => undefined)
    serverProcess = undefined
  }
  throw new Error("Server did not start in time")
}

async function stopServer() {
  if (serverProcess) {
    serverProcess.stderr.cancel()
    serverProcess.stdout.cancel()
    try {
      serverProcess.kill("SIGTERM")
    } catch {
      // ignore errors when killing the process
    }
    await serverProcess.status.catch(() => undefined)
    serverProcess = undefined
  }
}

async function clearDenoKV() {
  const kv = await Deno.openKv()
  for await (const entry of kv.list({ prefix: ["identities"] })) {
    await kv.delete(entry.key)
  }
  kv.close()
}

Deno.test("POST / single operation", async () => {

  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const operation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const message = await signMessage({ raw: toRawOperation(operation) }, keyPair)
 
  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 1)
  assertEquals(body[0].name, "Vani")
  assertEquals(body[0].primaryKey, "VAN146G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assertEquals(body[0].operations[0].type, "CREATE")
  assertEquals(body[0].operations.length, 1)

  await stopServer()
})

Deno.test("POST / two operations", async () => {

  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation) }, keyPair),
    await signMessage({ raw: `Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02
${ createOperation.hash }
1
body
line2
`, }, keyPair)
  ]

  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 1)
  assertEquals(body[0].name, "Vani")
  assertEquals(body[0].operations.length, 2)
  assertEquals(body[0].operations[0].type, "CREATE")
  assertEquals(body[0].operations[1].type, "SET")
  assertEquals(body[0].body, "body\nline2\n")

  await stopServer()
})

Deno.test("POST / two CREATE operations", async () => {

  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation1 = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const createOperation2 = await createCreateOperation("Item-1")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation1) }, keyPair),
    await signMessage({ raw: toRawOperation(createOperation2) }, keyPair)
  ]

  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 2)
  assertEquals(body[0].name, "Vani")
  assertEquals(body[1].id, "Item-1")

  await stopServer()
})
