import fs from 'fs-extra';
import { generateModelsInline, generateMutatorImports } from '../generators';
import { WriteModeProps } from '../types';
import {
  camel,
  getFileInfo,
  isSyntheticDefaultImportsAllow,
  upath,
} from '../utils';
import { generateTarget } from './target';

export const writeSingleMode = async ({
  builder,
  output,
  specsName,
  header,
  needSchema,
}: WriteModeProps): Promise<string[]> => {
  try {
    const { path, dirname } = getFileInfo(output.target, {
      backupFilename: camel(builder.info.title),
    });

    const {
      imports,
      importsMSW,
      implementation,
      implementationMSW,
      mutators,
      clientMutators,
      formData,
      formUrlEncoded,
    } = generateTarget(builder, output);

    let data = header;

    const schemasPath = output.schemas
      ? upath.relativeSafe(dirname, getFileInfo(output.schemas).dirname)
      : undefined;

    const isAllowSyntheticDefaultImports = isSyntheticDefaultImportsAllow(
      output.tsconfig,
    );

    data += builder.imports({
      client: output.client,
      implementation,
      imports: schemasPath
        ? [
            {
              exports: imports.filter(
                (imp) => !importsMSW.some((impMSW) => imp.name === impMSW.name),
              ),
              dependency: schemasPath,
            },
          ]
        : [],
      specsName,
      hasSchemaDir: !!output.schemas,
      isAllowSyntheticDefaultImports,
      hasGlobalMutator: !!output.override.mutator,
      packageJson: output.packageJson,
    });

    if (output.mock) {
      data += builder.importsMock({
        implementation: implementationMSW,
        imports: schemasPath
          ? [{ exports: importsMSW, dependency: schemasPath }]
          : [],
        specsName,
        hasSchemaDir: !!output.schemas,
        isAllowSyntheticDefaultImports,
      });
    }

    if (mutators) {
      data += generateMutatorImports({ mutators, implementation });
    }

    if (clientMutators) {
      data += generateMutatorImports({ mutators: clientMutators });
    }

    if (formData) {
      data += generateMutatorImports({ mutators: formData });
    }

    if (formUrlEncoded) {
      data += generateMutatorImports({ mutators: formUrlEncoded });
    }

    if (!output.schemas && needSchema) {
      data += generateModelsInline(builder.schemas);
    }

    data += `\n\n${implementation}`;

    if (output.mock) {
      data += '\n\n';
      data += implementationMSW;
    }

    await fs.outputFile(path, data);

    return [path];
  } catch (e) {
    throw `Oups... 🍻. An Error occurred while writing file => ${e}`;
  }
};
