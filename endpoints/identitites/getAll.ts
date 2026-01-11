import { RouterContext } from "@oak/oak/router"
import ROUTES from "../ROUTES.ts"
import { retrieveAll } from "../../lib/db/kv.ts"

export default async (ctx: RouterContext<typeof ROUTES.GET_IDENTITIES>) => {
  ctx.response.body = await retrieveAll()
}