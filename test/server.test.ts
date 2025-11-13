import { assert, assertEquals } from "@std/assert"

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
  for await (const entry of kv.list({ prefix: ["vanice"] })) {
    await kv.delete(entry.key)
  }
  await kv.close()
}

Deno.test("POST / single operation", async () => {

  await startServer()
  await clearDenoKV()

  const payload = {
    raw: "Vanic|2B5E9HJQPKJADKCK0SD3G7XEHNFYSXKVPQ9CVS6EW8G1N5031",
    signature: "154ff5ca0949a2e6f733533c27f239afcb50053d2953fabb692d50cad37bdefc0e0126b835308d1b526a528cbaed0a7ee4915077079f9364cc364696bb45f2c4"
  }
 
  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 1)
  assertEquals(body[0].name, "Vanic")
  assertEquals(body[0].primaryKey, "VAN1C2B5E9HJQPKJADKCK0SD3G7XEHNFYSXKVPQ9CVS6EW8G1N5031")
  assertEquals(body[0].operations[0].type, "CREATE")
  assertEquals(body[0].operations.length, 1)

  await stopServer()
})

Deno.test("POST / two operations", async () => {

  await startServer()
  await clearDenoKV()

  const payload = [{
    raw: "Vanic|2B5E9HJQPKJADKCK0SD3G7XEHNFYSXKVPQ9CVS6EW8G1N5031",
    signature: "154ff5ca0949a2e6f733533c27f239afcb50053d2953fabb692d50cad37bdefc0e0126b835308d1b526a528cbaed0a7ee4915077079f9364cc364696bb45f2c4"
  }, {
    raw: `Vanic|2B5E9HJQPKJADKCK0SD3G7XEHNFYSXKVPQ9CVS6EW8G1N5031
5f0d96078bc3443121da5d241d4d9ada7698c7c21c28ad60202291973de97040
1
body
line2
`,
    signature: "6ee0d8682e734cb97119045affde15147ec0dab1df26a1de55f50701024502150245dc7b851b97676cf533d48523c734f6e93d0ae65c50f7c3985a94889d3fb4"
  }]
 
  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 1)
  assertEquals(body[0].name, "Vanic")
  assertEquals(body[0].operations.length, 2)
  assertEquals(body[0].operations[0].type, "CREATE")
  assertEquals(body[0].operations[1].type, "SET")
  assertEquals(body[0].body, "body\nline2\n")

  await stopServer()
})

Deno.test("POST / two CREATE operations", async () => {

  await startServer()
  await clearDenoKV()

  const payload = [{
    raw: "Vanic|2B5E9HJQPKJADKCK0SD3G7XEHNFYSXKVPQ9CVS6EW8G1N5031",
    signature: "154ff5ca0949a2e6f733533c27f239afcb50053d2953fabb692d50cad37bdefc0e0126b835308d1b526a528cbaed0a7ee4915077079f9364cc364696bb45f2c4"
  }, {
    raw: "Test|PMTXGP6U13PDBFB9R5JP0C46NJFGJMY78BY16ANMVVEND5600",
    signature: "d847eaa1937b8953f81685046a85af1d55ca47043bd0bd53adba8583ffc03ef8efc7ad7887d6b852eea7b434f53006c5bb36b034dd9af4b10333638e034fdc07"
  }]
 
  const response = await fetch(`${ BASE_URL }/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  })
  assertEquals(response.status, 200)
  const body = await response.json()
  assert(Array.isArray(body))
  assertEquals(body.length, 2)
  assertEquals(body[0].name, "Vanic")
  assertEquals(body[1].name, "Test")

  await stopServer()
})

