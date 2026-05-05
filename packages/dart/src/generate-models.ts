import nodePath from 'node:path';

import type { ClientFileBuilder } from '@orval/core';

import {
  type DartField,
  fromJsonExpr,
  resolveSchemaFields,
  type SchemaLike,
  toJsonExpr,
} from './dart-types';
import { toSnakeCase } from './utils';

/**
 * Generate Dart model files for every component schema in the spec.
 */
export function generateDartModels(
  schemas: Record<string, SchemaLike>,
  modelsDir: string,
): ClientFileBuilder[] {
  const files: ClientFileBuilder[] = [];
  const schemaNames = Object.keys(schemas);

  for (const [name, schema] of Object.entries(schemas)) {
    const content = generateDartClass(name, schema, schemaNames);
    const fileName = toSnakeCase(name) + '.dart';
    files.push({
      path: nodePath.join(modelsDir, fileName),
      content,
    });
  }

  files.push({
    path: nodePath.join(modelsDir, 'models.dart'),
    content: generateModelsBarrel(schemaNames),
  });

  return files;
}

function generateDartClass(
  className: string,
  schema: SchemaLike,
  allSchemaNames: string[],
): string {
  const fields = resolveSchemaFields(schema);
  const imports = collectImports(fields, className, allSchemaNames);

  let out = '';

  // imports
  for (const imp of imports) {
    out += `import '${imp}.dart';\n`;
  }
  if (imports.length > 0) out += '\n';

  // class declaration
  out += `class ${className} {\n`;

  // fields
  for (const f of fields) {
    out += `  final ${f.fullType} ${f.name};\n`;
  }

  if (fields.length > 0) out += '\n';

  // constructor
  out += `  ${className}({\n`;
  for (const f of fields) {
    const req = f.isRequired ? 'required ' : '';
    const def = f.defaultValue !== undefined ? ` = ${f.defaultValue}` : '';
    out += `    ${req}this.${f.name}${def},\n`;
  }
  out += '  });\n\n';

  // fromJson
  out += generateFromJson(className, fields);
  out += '\n';

  // toJson
  out += generateToJson(fields);

  // copyWith
  out += '\n';
  out += generateCopyWith(className, fields);

  out += '}\n';
  return out;
}

function generateFromJson(className: string, fields: DartField[]): string {
  let out = `  factory ${className}.fromJson(Map<String, dynamic> json) {\n`;
  out += `    return ${className}(\n`;
  for (const f of fields) {
    out += `      ${f.name}: ${fromJsonExpr(f)},\n`;
  }
  out += '    );\n';
  out += '  }\n';
  return out;
}

function generateToJson(fields: DartField[]): string {
  let out = '  Map<String, dynamic> toJson() {\n';
  out += '    return {\n';
  for (const f of fields) {
    out += `      '${f.jsonName}': ${toJsonExpr(f)},\n`;
  }
  out += '    };\n';
  out += '  }\n';
  return out;
}

function generateCopyWith(className: string, fields: DartField[]): string {
  if (fields.length === 0) return '';

  let out = `  ${className} copyWith({\n`;
  for (const f of fields) {
    const paramType = f.dartType === 'dynamic' ? 'dynamic' : `${f.dartType}?`;
    out += `    ${paramType} ${f.name},\n`;
  }
  out += '  }) {\n';
  out += `    return ${className}(\n`;
  for (const f of fields) {
    out += `      ${f.name}: ${f.name} ?? this.${f.name},\n`;
  }
  out += '    );\n';
  out += '  }\n';
  return out;
}

function collectImports(
  fields: DartField[],
  selfName: string,
  allSchemaNames: string[],
): string[] {
  const allSchemaSnake = new Set(allSchemaNames.map(toSnakeCase));
  const selfSnake = toSnakeCase(selfName);
  const imports = new Set<string>();

  for (const f of fields) {
    for (const imp of f.typeResult.imports) {
      if (imp !== selfSnake && allSchemaSnake.has(imp)) {
        imports.add(imp);
      }
    }
    if (f.typeResult.listItemType) {
      for (const imp of f.typeResult.listItemType.imports) {
        if (imp !== selfSnake && allSchemaSnake.has(imp)) {
          imports.add(imp);
        }
      }
    }
  }

  return [...imports].sort();
}

function generateModelsBarrel(schemaNames: string[]): string {
  return (
    schemaNames
      .map((n) => toSnakeCase(n))
      .sort()
      .map((n) => `export '${n}.dart';`)
      .join('\n') + '\n'
  );
}
