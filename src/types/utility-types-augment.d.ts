/**
 * utility-types-augment.d.ts
 * list.types.ts 错误地从 utility-types 导入了 Pick（TypeScript 内置类型，无需导入）。
 * 此声明文件补充缺失的导出，使 typecheck 通过，同时不修改原类型文件。
 */
declare module 'utility-types' {
  export type Pick<T, K extends keyof T> = { [P in K]: T[P] }
}
