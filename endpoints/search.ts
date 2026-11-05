import type { Context } from "hono"
import type { AppEnv } from "../lib/env.ts"
import { withMessages } from "../lib/withMessages.ts"
import routes from "./routes.ts"

const MAX_SEARCH_TERM_LENGTH = 256

export default async (ctx: Context<AppEnv, typeof routes.GET_SEARCH>) => {
  const term = ctx.req.param("term")
  if (term.length > MAX_SEARCH_TERM_LENGTH) {
    return ctx.json({ error: `Search term must be ${MAX_SEARCH_TERM_LENGTH} characters or fewer` }, 400)
  }

  const results = await ctx.get("db").search(term)
  return ctx.json(
    await withMessages(
      results.map(({ entity }) => entity),
      ctx.get("operationStore")
    )
  )
}
