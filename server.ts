import type { Context, RouterContext } from "@oak/oak"
import { Application, Router } from "@oak/oak"
import { buildIdentityFromOperations, isCreateOperation, isFingerprintedName, isName, isNameKey, NameKey, splitFingerprintedName } from "@vanice/types"
import { isAcceptedOperation, areIncomingMessages, validateMessages, groupMessagesById, cleanIncomingMessages } from "./lib/Operation.ts"
import { insert, retrieveAll, retrieveByName, retrieveByNameKey } from "./lib/db/kv.ts"
import getMe from "./lib/getMe.ts"
import toArray from "./lib/utils/toArray.ts"
import migration from "./migrations/publicKeyDisplay.ts"

await migration()


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
  const identity = await retrieveByNameKey(nameKey)
  if (identity === undefined) {
    ctx.response.status = 404
    ctx.response.body = { error: `Identity with nameKey: ${ nameKey } not found` }
    return
  }
  ctx.response.body = identity
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
  if (areIncomingMessages(arr)) {
    const incomingMessages = cleanIncomingMessages(arr)
    try {
      const validatedMessages = await validateMessages(incomingMessages)
      const groupedMessages = groupMessagesById(validatedMessages)
      const response = []
      for (const id in groupedMessages) {
        const nameKey = id as NameKey
        const currentEntry = await retrieveByNameKey(nameKey)
        const messages = groupedMessages[nameKey]
        const operations = messages.map(({ operation }) => operation)
        if (currentEntry === undefined && operations.some(isCreateOperation) === false) {
          throw new Error(`Identity: ${ id } does not exist on this server. And no operation of type CREATE supplied.`)
        }
        // TODO: Save different messages of the same operation
        const newOperations = currentEntry ? 
          operations.filter(operation => isAcceptedOperation(currentEntry, operation)) : 
          operations
        if (newOperations.length === 0) {
          response.push(currentEntry)
        } else {
          const nextOperations = currentEntry ? [...currentEntry.operations, ...newOperations] : newOperations
          const nextIdentity = await buildIdentityFromOperations(nextOperations, nameKey)
          const entry = { ...nextIdentity, messages }
          await insert(entry)
          response.push(entry)
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
