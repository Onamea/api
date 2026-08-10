import { RouterContext } from "@oak/oak/router"
import ROUTES from "../ROUTES.ts"
import { isNameKey } from "@onamea/types"
import { retrieveById } from "../../lib/db/kv.ts"

export default async (ctx: RouterContext<typeof ROUTES.GET_IDENTITIES_BY_ID>) => {

  const id = ctx.params.id

  if (isNameKey(id) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: `Invalid Identity Id: ${ id }` }
    return
  }

  const identity = await retrieveById(id)
  if (identity === undefined) {
    ctx.response.status = 404
    ctx.response.body = { error: `No Identity with Id: ${ id } found` }
    return
  }

  ctx.response.body = identity
}
