import { Context } from "@oak/oak/context"

export default async (ctx: Context, next: () => Promise<unknown>) => {
  ctx.response.headers.set("Access-Control-Allow-Origin", "*")
  ctx.response.headers.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS")
  ctx.response.headers.set("Access-Control-Allow-Headers", "Content-Type")
  if (ctx.request.method === "OPTIONS") {
    ctx.response.status = 204
    return
  }
  await next()
}