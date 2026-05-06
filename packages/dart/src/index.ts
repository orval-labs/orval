import nodePath from 'node:path';

import type {
  ClientBuilder,
  ClientExtraFilesBuilder,
  ClientFileBuilder,
  ClientGeneratorsBuilder,
} from '@orval/core';

import { generateDartApiClients } from './generate-client';
import { generateDartModels } from './generate-models';

const generateDartClient: ClientBuilder = () => {
  return { implementation: '', imports: [] };
};

const generateDartExtraFiles: ClientExtraFilesBuilder = async (
  _verbOptions,
  output,
  context,
) => {
  // Dart target is a directory, not a file — use it directly.
  // Strip a trailing file extension if someone passes a .ts/.dart file path.
  const raw = output.target;
  const outputDir = /\.\w+$/.test(nodePath.basename(raw))
    ? nodePath.dirname(raw)
    : raw;
  const modelsDir = nodePath.join(outputDir, 'models');
  const apiDir = nodePath.join(outputDir, 'api');

  const schemas =
    (context.spec.components?.schemas as Record<string, unknown>) ?? {};
  const allSchemaNames = Object.keys(schemas);

  const modelFiles = generateDartModels(schemas, modelsDir);
  const apiFiles = generateDartApiClients(context.spec, apiDir, allSchemaNames);

  const barrelLines = [
    "export 'models/models.dart';",
    "export 'api/api.dart';",
    '',
  ];
  const barrelFile: ClientFileBuilder = {
    path: nodePath.join(outputDir, 'generated.dart'),
    content: barrelLines.join('\n'),
  };

  return [...modelFiles, ...apiFiles, barrelFile];
};

const dartClientBuilder: ClientGeneratorsBuilder = {
  client: generateDartClient,
  extraFiles: generateDartExtraFiles,
};

export const builder = () => () => dartClientBuilder;

export default builder;
