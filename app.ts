import { Hono } from "hono"
import type { AppEnv } from "./lib/env.ts"
import { createWorkersKv } from "./lib/db/workersKv.ts"
import { createOperationStore, OperationStore } from "./lib/db/operationStore.ts"
import routes from "./endpoints/routes.ts"
import CORS from "./endpoints/middleware/CORS.ts"
import errorHandling from "./endpoints/middleware/errorHandling.ts"
import getAll from "./endpoints/identitites/getAll.ts"
import getById from "./endpoints/identitites/getById.ts"
import getByName from "./endpoints/identitites/getByName.ts"
import getMe from "./endpoints/me/get.ts"
import post from "./endpoints/operations/post.ts"
import getItemById from "./endpoints/items/getById.ts"

const app = new Hono<AppEnv>()

app.use("*", CORS)
app.use("*", async (ctx, next) => {
  ctx.set("db", createWorkersKv(ctx.env.ONAMEA_KV))
  ctx.set("operationStore", createOperationStore(ctx.env.OPERATION_STORE))
  await next()
})
app.onError(errorHandling)

// GET /identities
app.get(routes.GET_IDENTITIES, getAll)

// GET /identities/{id}
app.get(routes.GET_IDENTITIES_BY_ID, getById)

// GET /identities/{name}
app.get(routes.GET_IDENTITIES_BY_NAME, getByName)

// GET /items/{id}
app.get(routes.GET_ITEMS_BY_ID, getItemById)

// GET /me
app.get(routes.GET_ME, getMe)

// POST /
app.post(routes.POST, post)

export default app

// Wrangler resolves the Durable Object class from the Worker entry point.
export { OperationStore }
