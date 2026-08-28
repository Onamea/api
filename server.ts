import { Application, Router } from "@oak/oak"
import ROUTES from "./endpoints/ROUTES.ts"
import CORS from "./endpoints/middleware/CORS.ts"
import errorHandling from "./endpoints/middleware/errorHandling.ts"
import getAll from "./endpoints/identitites/getAll.ts"
import getById from "./endpoints/identitites/getById.ts"
import getByName from "./endpoints/identitites/getByName.ts"
import getMe from "./endpoints/me/get.ts"
import post from "./endpoints/operations/post.ts"
import getItemById from "./endpoints/items/getById.ts"

import clearMigration from "./migrations/clear.ts"

await clearMigration()

// Create Oak application
const app = new Application()
const router = new Router()

// CORS middleware
app.use(CORS)

// GET /identities
router.get(ROUTES.GET_IDENTITIES, getAll)

// GET /identities/{id}
router.get(ROUTES.GET_IDENTITIES_BY_ID, getById)

// GET /identities/{name}
router.get(ROUTES.GET_IDENTITIES_BY_NAME, getByName)

// GET /items/{id}
router.get(ROUTES.GET_ITEMS_BY_ID, getItemById)

// GET /me
router.get(ROUTES.GET_ME, getMe)

// POST /
router.post(ROUTES.POST, post)

// Error handling middleware
app.use(errorHandling)

app.use(router.routes())
app.use(router.allowedMethods())

// Start server
const port = Deno.env.get("PORT") ?? "8000"
console.log(`Starting server on port ${ port }...`)
await app.listen({ port: Number(port) })
