export function assertExhaustive(value: never): never {
  throw new Error(`Unexpected enum value: ${JSON.stringify(value)}`)
}
