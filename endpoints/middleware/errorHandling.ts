import type { ErrorHandler } from "hono"
import type { AppEnv } from "../../lib/env.ts"

const errorHandling: ErrorHandler<AppEnv> = (error, ctx) => {
  return ctx.json({ error: error instanceof Error ? error.message : String(error) }, 500)
}

export default errorHandling
