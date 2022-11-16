declare module 'esutils' {
  export namespace keyword {
    export function isIdentifierNameES5(str: string): boolean;
    export function isKeywordES5(id: string, strict: boolean): boolean;
  }
}
