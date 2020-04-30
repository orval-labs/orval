import { camel, kebab, pascal } from 'case';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { InfoObject } from 'openapi3-ts';
import { join } from 'path';
import { OutputOptions } from '../../types';
import {
  GeneratorOperation,
  GeneratorOperations,
  GeneratorTarget,
} from '../../types/generator';
import { WriteSpecsProps } from '../../types/writers';
import { getFileInfo } from '../../utils/file';
import { generalTypesFilter } from '../../utils/filters';
import { isObject } from '../../utils/is';
import { getFilesHeader } from '../../utils/messages/inline';
import {
  generateClientFooter,
  generateClientHeader,
} from '../generators/client';
import { generateImports } from '../generators/imports';
import { generateModelsInline } from '../generators/modelsInline';
import { resolvePath } from '../resolvers/path';

const generateTargetTags = (
  currentAcc: { [key: string]: GeneratorTarget },
  operation: GeneratorOperation,
  info: InfoObject,
) =>
  operation.tags.reduce((acc, tag) => {
    const currentOperation = acc[tag];
    if (!currentOperation) {
      const header = generateClientHeader(pascal(`${info.title} ${tag}`));

      return {
        ...acc,
        [tag]: {
          imports: [...operation.imports, ...operation.importsMocks],
          definition: header.definition + operation.definition,
          implementation: header.implementation + operation.implementation,
          implementationMocks:
            header.implementationMock + operation.implementationMocks,
        },
      };
    }

    return {
      ...acc,
      [tag]: {
        definition: currentOperation.definition + operation.definition,
        implementation:
          currentOperation.implementation + operation.implementation,
        imports: [
          ...currentOperation.imports,
          ...operation.imports,
          ...operation.importsMocks,
        ],
        implementationMocks:
          currentOperation.implementationMocks + operation.implementationMocks,
      },
    };
  }, currentAcc);

export const generateTarget = (
  operations: GeneratorOperations,
  info: InfoObject,
) =>
  Object.values(operations).reduce((acc, operation, index, arr) => {
    const targetTags = generateTargetTags(acc, operation, info);

    if (index === arr.length - 1) {
      const footer = generateClientFooter();

      return Object.entries(targetTags).reduce((acc, [tag, target]) => {
        return {
          ...acc,
          [tag]: {
            definition: target.definition + footer.definition,
            implementation: target.implementation + footer.implementation,
            implementationMocks:
              target.implementationMocks + footer.implementationMock,
            imports: generalTypesFilter(target.imports),
          },
        };
      }, {});
    }

    return targetTags;
  }, {} as { [key: string]: GeneratorTarget });

export const writeTagsMode = ({
  operations,
  schemas,
  info,
  output,
}: WriteSpecsProps & { output: OutputOptions }) => {
  const { path, filename, dirname, extension } = getFileInfo(
    output.target,
    camel(info.title),
  );

  if (!existsSync(dirname)) {
    mkdirSync(dirname);
  }

  const target = generateTarget(operations, info);

  Object.entries(target).forEach(([tag, target]) => {
    const { definition, imports, implementation, implementationMocks } = target;
    const header = getFilesHeader(info);
    let data = header;
    data +=
      "import { AxiosPromise, AxiosInstance, AxiosRequestConfig } from 'axios';\n";
    data +=
      isObject(output) && output.mock ? "import faker from 'faker';\n" : '\n';

    if (isObject(output) && output.schemas) {
      data += generateImports(imports, resolvePath(path, output.schemas), true);
    } else {
      const schemasPath = './' + filename + '.schemas';
      const schemasData = header + generateModelsInline(schemas);

      writeFileSync(join(dirname, schemasPath + extension), schemasData);

      data += generateImports(imports, schemasPath, true);
    }

    data += '\n';
    data += definition;
    data += '\n\n';
    data += implementation;

    if (isObject(output) && output.mock) {
      data += '\n\n';
      data += implementationMocks;
    }

    writeFileSync(join(dirname, `${filename}.${kebab(tag)}${extension}`), data);
  });
};
