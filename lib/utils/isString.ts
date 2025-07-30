export default (value: unknown): value is string => {
  return typeof value === "string"
}