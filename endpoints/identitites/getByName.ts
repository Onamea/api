import { RouterContext } from "@oak/oak/router"
import ROUTES from "../ROUTES.ts"
import { isFingerprintedName, isName, parseFingerprintedName } from "@vanice/types"
import { retrieveByName } from "../../lib/db/kv.ts"

export default async (ctx: RouterContext<typeof ROUTES.GET_IDENTITIES_BY_NAME>) => {

  const suppliedName = ctx.params.name
  const [name, fingerprintDisplay] = isFingerprintedName(suppliedName) ? parseFingerprintedName(suppliedName) : [suppliedName]

  if (isName(name) === false) {
    ctx.response.status = 400
    ctx.response.body = { error: "Invalid param: name" }
    return
  }

  ctx.response.body = await retrieveByName(name, fingerprintDisplay)
}

