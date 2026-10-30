import type { MiddlewareHandler } from "hono"

const CORS: MiddlewareHandler = async (ctx, next) => {
  ctx.header("Access-Control-Allow-Origin", "*")
  ctx.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  ctx.header("Access-Control-Allow-Headers", "Content-Type")
  if (ctx.req.method === "OPTIONS") {
    return ctx.body(null, 204)
  }
  await next()
}

export default CORS
