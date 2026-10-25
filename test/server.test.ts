import { test } from "node:test"
import { spawn, type ChildProcess } from "node:child_process"
import assert from "node:assert/strict"
import { keyPairFromPrivateKey } from "@onamea/types"
import { createCreateOperation, signMessage, toRawOperation } from "@onamea/crdt"
import { cryptoName, privateKey } from "./data.mock.ts"

const BASE_URL = "http://localhost:8000"

let serverProcess: ChildProcess | undefined

async function startServer() {
  serverProcess = spawn("node", ["server.ts"], { stdio: ["ignore", "pipe", "pipe"] })
  let output = ""
  serverProcess.stdout?.on("data", chunk => (output += chunk))
  serverProcess.stderr?.on("data", chunk => (output += chunk))
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
  console.error(output)
  await stopServer()
  throw new Error("Server did not start in time")
}

async function stopServer() {
  if (serverProcess) {
    const exited = new Promise(resolve => serverProcess?.once("exit", resolve))
    serverProcess.stdout?.destroy()
    serverProcess.stderr?.destroy()
    serverProcess.kill("SIGTERM")
    await exited
    serverProcess = undefined
  }
}

// TODO: port Deno.kv
async function clearDenoKV() {}

test("POST / single operation", async () => {
  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const operation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const message = await signMessage({ raw: toRawOperation(operation) }, keyPair)

  const response = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(message)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 1)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[0].displayName, "Vani💪❤️❤️🎄🌙🔥")
  assert.equal(body[0].operations[0].type, "CREATE")
  assert.equal(body[0].operations.length, 1)

  await stopServer()
})

test("POST / two operations", async () => {
  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation) }, keyPair),
    await signMessage(
      {
        raw: `Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02
${createOperation.hash}
SET
body
line2
`
      },
      keyPair
    )
  ]

  const response = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 1)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[0].operations.length, 2)
  assert.equal(body[0].operations[0].type, "CREATE")
  assert.equal(body[0].operations[1].type, "SET")
  assert.equal(body[0].body, "body\nline2\n")

  await stopServer()
})

test("POST / two CREATE operations", async () => {
  await startServer()
  await clearDenoKV()

  const keyPair = keyPairFromPrivateKey(cryptoName, privateKey)
  const createOperation1 = await createCreateOperation("Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  const createOperation2 = await createCreateOperation("Item-1")
  const messages = [
    await signMessage({ raw: toRawOperation(createOperation1) }, keyPair),
    await signMessage({ raw: toRawOperation(createOperation2) }, keyPair)
  ]

  const response = await fetch(`${BASE_URL}/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(messages)
  })
  assert.equal(response.status, 200)
  const body = await response.json()
  assert.ok(Array.isArray(body))
  assert.equal(body.length, 2)
  assert.equal(body[0].id, "Vani@46G1SR1HS4BH2QQXETN6H3T3R2UFD2AWUQEYVXPYTWEYYJN02")
  assert.equal(body[1].id, "Item-1")

  await stopServer()
})
