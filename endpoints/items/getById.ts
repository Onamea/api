import { RouterContext } from "@oak/oak/router"
import ROUTES from "../ROUTES.ts"
import { isId } from "@onamea/crdt"
import { retrieveItemById } from "../../lib/db/kv.ts"

export default async (ctx: RouterContext<typeof ROUTES.GET_ITEMS_BY_ID>) => {

  const id = ctx.params.id

  if (isId(id) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: `Invalid Item Id: ${ id }` }
    return
  }

  const item = await retrieveItemById(id)
  if (item === undefined) {
    ctx.response.status = 404
    ctx.response.body = { error: `No Item with Id: ${ id } found` }
    return
  }
  ctx.response.body = item
}
