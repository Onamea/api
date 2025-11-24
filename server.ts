import type { Context, RouterContext } from "@oak/oak"
import { Application, Router } from "@oak/oak"
import { buildFromOperations, isCreateOperation, isFingerprintedName, isName, isNameKey, NameKey, parseNameKey, splitFingerprintedName} from "@vanice/types"
import { areIncomingOperations, cleanIncomingOperation, validateOperations, isAcceptedOperation, groupOperationsById } from "./lib/Operation.ts"
import { insert, retrieveAll, retrieveByName, retrieveByNameKey } from "./lib/db/kv.ts"
import getMe from "./lib/getMe.ts"
import toArray from "./lib/utils/toArray.ts"
import addNameKey from "./migrations/addNameKey.ts"

// Define route paths
const ROUTES = {
  GET_ALL: "/",
  GET_BY_NAME: "/name/:name",
  GET_BY_NAME_KEY: "/namekey/:nameKey",
  GET_ME: "/me",
  POST: "/"
  //DELETE: "/:key"
} as const

// Create Oak application
const app = new Application()
const router = new Router()

// Run migrations
await addNameKey()

// CORS middleware
app.use(async (ctx: Context, next: () => Promise<unknown>) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*")
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204
    return
  }
  await next()
})

// GET /
router.get(ROUTES.GET_ALL, async (ctx: RouterContext<typeof ROUTES.GET_ALL>) => {
  ctx.response.body = await retrieveAll()
})

// GET /name/{name}
router.get(ROUTES.GET_BY_NAME, async (ctx: RouterContext<typeof ROUTES.GET_BY_NAME>) => {
  const suppliedName = ctx.params.name
  const [name,, fingerprint] = isFingerprintedName(suppliedName) ? splitFingerprintedName(suppliedName) : [suppliedName]
  if (isName(name) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid param: name" }
    return
  }
  ctx.response.body = await retrieveByName(name, fingerprint)
})

// GET /namekey/{nameKey}
router.get(ROUTES.GET_BY_NAME_KEY, async (ctx: RouterContext<typeof ROUTES.GET_BY_NAME_KEY>) => {
  const nameKey = ctx.params.nameKey
  if (isNameKey(nameKey) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: `Invalid param nameKey: ${ nameKey }` }
    return
  }
  ctx.response.body = await retrieveByNameKey(nameKey)
})

// GET /me
router.get(ROUTES.GET_ME, (ctx: RouterContext<typeof ROUTES.GET_ME>) => {
  const me = getMe()
  if (me !== undefined) {
    ctx.response.body = me
  } else {
    ctx.response.status = 404
    ctx.response.body = { error: "No Me data configured" }
  }
})

// POST /
router.post(ROUTES.POST, async (ctx: RouterContext<typeof ROUTES.POST>) => {
  const body = await ctx.request.body.json()
  const arr = toArray(body)
  if (areIncomingOperations(arr)) {
    const incomingOperations = arr.map(cleanIncomingOperation)
    try {
      const signedOperations = await validateOperations(incomingOperations)
      const groupedOperations = groupOperationsById(signedOperations)
      const response = []
      for (const id in groupedOperations) {
        const nameKey = id as NameKey
        const operations = groupedOperations[nameKey]
        const currentIdentity = await retrieveByNameKey(nameKey)
        if (currentIdentity === undefined && isCreateOperation(operations[0]) === false) {
          throw new Error(`Identity: ${ id } does not exist on this server. First message must be of type CREATE.`)
        }
        const newOperations = currentIdentity ? operations.filter(operation => isAcceptedOperation(currentIdentity, operation)) : operations
        if (newOperations.length === 0) {
          response.push(currentIdentity)
        } else {
          const [primaryKey, name] = parseNameKey(id)
          const nextOperations = currentIdentity ? [...currentIdentity.operations, ...newOperations] : newOperations
          const nextIdentity = await buildFromOperations(nextOperations, primaryKey, name)
          await insert(nextIdentity)
          response.push(nextIdentity)
        }
      }
      ctx.response.body = response
    } catch (error) {
      ctx.response.status = 400
      ctx.response.body = { error: (error as Error).message }
    }
  } else {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid request body" }
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
const port = Deno.env.get("PORT") ?? "8000"
console.log(`Starting server on port ${port}...`)
await app.listen({ port: Number(port) })
