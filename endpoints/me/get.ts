import { RouterContext } from "@oak/oak/router"
import ROUTES from "../ROUTES.ts"
import getMe from "../../lib/getMe.ts"

export default (ctx: RouterContext<typeof ROUTES.GET_ME>) => {
  const me = getMe()
  if (me !== undefined) {
    ctx.response.body = me
  } else {
    ctx.response.status = 404
    ctx.response.body = { error: "No Me data configured" }
  }
}