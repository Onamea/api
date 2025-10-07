import type { Context, RouterContext } from "oak"
import { Application, Router } from "oak"
import { isFingerprintedName, isName, splitFingerprintedName } from "@vanice/types"
import { extendData, validateData } from "./lib/Data.ts"
import { insert, retrieveAll, retrieveByName } from "./lib/db/kv.ts"
//import { insert, retrieveAll, retrieveByName } from "./lib/db/postgres.ts"
import { getMeData } from "./lib/getMeData.ts"

// Define route paths
const ROUTES = {
  GET_ALL: "/",
  GET_BY_NAME: "/name/:name",
  GET_ME: "/me",
  POST: "/"
  //DELETE: "/:key"
} as const

// Create Oak application
const app = new Application()
const router = new Router()

// CORS middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*")
  await next()
})

// GET /
router.get(ROUTES.GET_ALL, async (ctx: RouterContext<typeof ROUTES.GET_ALL>) => {
  ctx.response.body = await retrieveAll()
})

// GET /name/{vanity_name}
router.get(ROUTES.GET_BY_NAME, async (ctx: RouterContext<typeof ROUTES.GET_BY_NAME>) => {
  const suppliedName = ctx.params.name
  const [name, fingerprint] = isFingerprintedName(suppliedName) ? splitFingerprintedName(suppliedName) : [suppliedName]
  if (isName(name) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid param: name" }
    return
  }
  ctx.response.body = await retrieveByName(name, fingerprint)
})

// GET /me
router.get(ROUTES.GET_ME, (ctx: RouterContext<typeof ROUTES.GET_ME>) => {
  const meData = getMeData()
  if (meData !== undefined) {
    ctx.response.body = meData
  } else {
    ctx.response.status = 404
    ctx.response.body = { error: "No Me data configured" }
  }
})

// POST /
router.post(ROUTES.POST, async (ctx: RouterContext<typeof ROUTES.POST>) => {
  const data = await ctx.request.body.json()
  const isValid = validateData(data)
  if (isValid) {
    const extendedData = await extendData(data)
    await insert(extendedData)
    ctx.response.body = extendedData
  } else {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid data" }
  }
})

// DELETE /{key}
/*
router.delete(ROUTES.DELETE, async (ctx: RouterContext<typeof ROUTES.DELETE>) => {

  const primaryName = ctx.params.primaryName
  const primaryKey = ctx.params.primaryKey
  // TODO Validate primaryName and primaryKey

  const key = ["vanice", primaryName, primaryKey]
  const entry = await kv.get(key)

  if (entry.value) {
    const data = entry.value as KVData
    data.tombstone = true
    await kv.set(key, data)
    ctx.response.body = { message: "Marked as deleted" }
  } else {
    ctx.response.status = 404
    ctx.response.body = { message: "Not found" }
  }
})
*/

// Error handling middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  try {
    await next()
  } catch (error) {
    ctx.response.status = 500
    ctx.response.body = { error }
  }
})

app.use(router.routes())
app.use(router.allowedMethods())

// Start server
const port = Deno.env.get("PORT") || "8000"
console.log(`Starting server on port ${port}...`)
await app.listen({ port: Number(port) })
