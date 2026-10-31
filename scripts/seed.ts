import { readFile } from "node:fs/promises"

const apiUrl = new URL(process.env.DEV_API_URL ?? "http://127.0.0.1:8787")
if (!["localhost", "127.0.0.1", "[::1]"].includes(apiUrl.hostname)) {
  throw new Error("DEV_API_URL must point to a local Wrangler dev server")
}

const message: unknown = JSON.parse(await readFile(new URL("../config/me.json", import.meta.url), "utf8"))
const response = await fetch(new URL("/", apiUrl), {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(message)
})

if (!response.ok) {
  throw new Error(`Dev seed failed (${response.status}): ${await response.text()}`)
}

console.log("Seeded the configured identity into the local database.")
