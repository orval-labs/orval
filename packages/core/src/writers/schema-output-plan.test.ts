import nodePath from 'node:path';

import { describe, expect, it } from 'vite-plus/test';

import { NamingConvention, type GeneratorSchema } from '../types';
import { createSchemaOutputPlan } from './schema-output-plan';

const createSchema = (
  name: string,
  kind: GeneratorSchema['kind'],
  imports: GeneratorSchema['imports'] = [],
): GeneratorSchema => ({
  name,
  kind,
  model: `export type ${name} = unknown;`,
  imports,
});

describe('createSchemaOutputPlan', () => {
  const basePath = '/tmp/orval-schema-plan/schemas';

  it('canonicalizes names before assigning enum and default routes', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        createSchema('UserStatus', 'enum'),
        createSchema('User', 'schema', [{ name: 'UserStatus' }]),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: true,
    });

    expect(plan.routeKeyByName.get('UserStatus')).toBe('enum');
    expect(plan.routePathByName.get('UserStatus')).toBe(
      nodePath.join(basePath, 'types'),
    );
    expect(plan.filePathByName.get('UserStatus')).toBe(
      nodePath.join(basePath, 'types', 'userStatus.ts'),
    );
    expect(plan.filePathByName.get('User')).toBe(
      nodePath.join(basePath, 'models', 'user.ts'),
    );
    expect(plan.rootIndexPath).toBe(nodePath.join(basePath, 'index.ts'));
  });

  it('falls back to the default route when no enum route is configured', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [createSchema('Status', 'enum')],
      routes: { default: 'models' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    expect(plan.routeKeyByName.get('Status')).toBe('default');
    expect(plan.routePathByName.get('Status')).toBe(
      nodePath.join(basePath, 'models'),
    );
    expect(plan.rootIndexPath).toBeUndefined();
  });

  it('registers operation schemas in the default route', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [createSchema('User', 'schema')],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    const filePath = plan.registerSchema('ListUsersParams', 'default');

    expect(filePath).toBe(
      nodePath.join(basePath, 'models', 'listUsersParams.ts'),
    );
    expect(plan.importPathFor('ListUsersParams', 'User')).toBe('./user');
    expect(plan.hasSchema('ListUsersParams')).toBe(true);
  });

  it('resolves a direct import from one route to another', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        createSchema('UserStatus', 'enum'),
        createSchema('User', 'schema'),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    expect(plan.importPathFor('User', 'UserStatus')).toBe(
      '../types/userStatus',
    );
  });

  it('nests tag scopes under their selected route', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        createSchema('UserStatus', 'enum'),
        createSchema('SharedError', 'schema'),
        createSchema('User', 'schema', [
          { name: 'UserStatus' },
          { name: 'SharedError' },
        ]),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: true,
      schemaTagMap: new Map([
        ['UserStatus', 'users'],
        ['SharedError', '.'],
        ['User', 'users'],
      ]),
    });

    expect(plan.usesTagRouting).toBe(true);
    expect(plan.scopePathByName.get('User')).toBe(
      nodePath.join(basePath, 'models', 'users'),
    );
    expect(plan.scopePathByName.get('SharedError')).toBe(
      nodePath.join(basePath, 'models', 'shared'),
    );
    expect(plan.filePathByName.get('UserStatus')).toBe(
      nodePath.join(basePath, 'types', 'users', 'userStatus.ts'),
    );
    expect(plan.importPathFor('User', 'UserStatus')).toBe(
      '../../types/users/userStatus',
    );
  });

  it('requires explicit kind metadata for routed schemas', () => {
    expect(() =>
      createSchemaOutputPlan({
        basePath,
        schemas: [
          {
            name: 'LegacyFixture',
            model: 'export type LegacyFixture = unknown;',
            imports: [],
          },
        ],
        routes: { default: 'models', enum: 'types' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.ts',
        indexFiles: true,
      }),
    ).toThrow('missing its kind metadata');
  });

  it('merges duplicate canonical schemas before assigning routes', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        createSchema('UserStatus', 'enum'),
        createSchema('user_status', 'enum'),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    expect(plan.canonicalSchemas).toHaveLength(1);
    expect(plan.filePathByName.get('UserStatus')).toBe(
      nodePath.join(basePath, 'types', 'userStatus.ts'),
    );
  });
});
