import { type Context, type RouterContext, Application, Router } from "https://deno.land/x/oak/mod.ts"
import meData from "./me.json" with { type: "json" }
import { type ExtendedData, extendData, validateData } from "./lib/Data.ts"
import { type PrimaryKey, isFingerprintedName, isName, splitFingerprintedName, toPrimaryChars } from "./vanice-utils/PrimaryKey.ts"

// Initialize KV database
const kv = await Deno.openKv()

// Define route paths
const ROUTES = {
  GET_ALL: "/",
  GET_BY_NAME: "/name/:name",
  GET_ME: "/me",
  POST: "/",
  //DELETE: "/:key"
} as const

// Create Oak application
const app = new Application()
const router = new Router()

// Me data
const meDataIsValid = validateData(meData)

// KVData 
type KVData = {
  key: ["vanice", PrimaryKey],
  value: ExtendedData
} 

// GET /
router.get(ROUTES.GET_ALL, async (ctx: RouterContext<typeof ROUTES.GET_ALL>) => {
  const entries = kv.list({ prefix: ["vanice"] })
  const values: KVData[] = []
  for await (const entry of entries) {
    values.push(entry as unknown as KVData)
  }
  // sort by primary key
  values.sort((a, b) => a.key[1].localeCompare(b.key[1]))
  ctx.response.body = values
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
  const primaryName = toPrimaryChars(name)
  const entries = kv.list({ prefix: ["vanice", primaryName] })
  const values = []
  for await (const entry of entries) {
    const data = entry.value as ExtendedData
    if (fingerprint === undefined || data.fingerprint.startsWith(fingerprint)) {
      values.push(data)
    }
  }
  ctx.response.body = values
})

// GET /me
router.get(ROUTES.GET_ME, (ctx: RouterContext<typeof ROUTES.GET_ME>) => {
  if (meDataIsValid) {
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
    const { primaryName, primaryKey } = extendedData
    const key = ["vanice", primaryName, primaryKey]
    await kv.set(key, extendedData)
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
console.log(`Starting server on port ${ port }...`)
await app.listen({ port: Number(port) })