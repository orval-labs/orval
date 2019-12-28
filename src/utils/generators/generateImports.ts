export const generateImports = (imports: string[] = [], path: string = '.', pathOnly: boolean = false) => {
  if (pathOnly) {
    return imports.sort().reduce((acc, imp, index) => {
      if (!acc) {
        return `import { ${imp},\n`;
      }
      if (imports.length - 1 === index) {
        return acc + `  ${imp},\n} from \'${path}\'; \n`;
      }

      return acc + `  ${imp},\n`;
    }, '');
  }
  return imports.sort().reduce((acc, imp) => acc + `import { ${imp} } from \'${path}/${imp}\'; \n`, '');
};
