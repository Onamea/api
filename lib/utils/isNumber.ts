export default (value: unknown): value is number => {
  return typeof value === "number" && !isNaN(value) && isFinite(value)
}