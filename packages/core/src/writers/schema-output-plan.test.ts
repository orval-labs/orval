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
        {
          ...createSchema('UserStatus', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
        {
          ...createSchema('user_status', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
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

  it('resolves aliases to the canonical schema file', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        {
          ...createSchema('UserStatus', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
        {
          ...createSchema('user_status', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
        createSchema('User', 'schema', [{ name: 'UserStatus' }]),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    expect(plan.canonicalNameByAlias.get('user_status')).toBe('UserStatus');
    expect(plan.importPathFor('User', 'user_status')).toBe(
      '../types/userStatus',
    );
    expect(plan.hasSchema('user_status')).toBe(true);
  });

  it('resolves multiple equivalent aliases from either side of an import', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        {
          ...createSchema('UserStatus', 'enum'),
          schema: {
            type: 'string',
            enum: ['active'],
            description: 'A user status',
          },
        },
        {
          ...createSchema('user_status', 'enum'),
          schema: {
            description: 'A user status',
            enum: ['active'],
            type: 'string',
          },
        },
        {
          ...createSchema('USER_STATUS', 'enum'),
          schema: {
            type: 'string',
            enum: ['active'],
            description: 'A user status',
          },
        },
        createSchema('User', 'schema'),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: false,
    });

    expect(plan.canonicalNameByAlias).toEqual(
      new Map([
        ['UserStatus', 'UserStatus'],
        ['user_status', 'UserStatus'],
        ['USER_STATUS', 'UserStatus'],
        ['User', 'User'],
      ]),
    );
    expect(plan.importPathFor('user_status', 'User')).toBe('../models/user');
    expect(plan.importPathFor('User', 'USER_STATUS')).toBe(
      '../types/userStatus',
    );
  });

  it('routes aliases through tag scopes', () => {
    const plan = createSchemaOutputPlan({
      basePath,
      schemas: [
        {
          ...createSchema('UserStatus', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
        {
          ...createSchema('user_status', 'enum'),
          schema: { type: 'string', enum: ['active'] },
        },
        createSchema('User', 'schema'),
      ],
      routes: { default: 'models', enum: 'types' },
      namingConvention: NamingConvention.CAMEL_CASE,
      fileExtension: '.ts',
      indexFiles: true,
      schemaTagMap: new Map([
        ['UserStatus', 'users'],
        ['User', 'users'],
      ]),
    });

    expect(plan.scopePathByName.get('UserStatus')).toBe(
      nodePath.join(basePath, 'types', 'users'),
    );
    expect(plan.importPathFor('User', 'user_status')).toBe(
      '../../types/users/userStatus',
    );
  });

  it('rejects distinct schemas that collide after naming conversion', () => {
    expect(() =>
      createSchemaOutputPlan({
        basePath,
        schemas: [
          {
            ...createSchema('UserStatus', 'enum'),
            schema: { type: 'string', enum: ['active'] },
          },
          {
            ...createSchema('user_status', 'enum'),
            schema: { type: 'string', enum: ['pending'] },
          },
        ],
        routes: { default: 'models', enum: 'types' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.ts',
        indexFiles: false,
      }),
    ).toThrow(
      'Schemas "UserStatus" and "user_status" produce the same generated file',
    );
  });

  it('rejects aliases that collide across generated schema kinds', () => {
    expect(() =>
      createSchemaOutputPlan({
        basePath,
        schemas: [
          {
            ...createSchema('UserStatus', 'enum'),
            schema: { type: 'string', enum: ['active'] },
          },
          {
            ...createSchema('user_status', 'schema'),
            schema: { type: 'string', enum: ['active'] },
          },
        ],
        routes: { default: 'models', enum: 'types' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.ts',
        indexFiles: false,
      }),
    ).toThrow(
      'Schemas "UserStatus" and "user_status" produce the same generated file',
    );
  });

  describe('packageImportPath', () => {
    it('includes custom fileExtension in package subpath', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [createSchema('Pet', 'schema')],
        routes: { default: 'models' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.gen.ts',
        indexFiles: false,
        importPath: '@acme/models',
      });

      expect(plan.packageImportPath('Pet')).toBe('@acme/models/models/pet.gen');
    });

    it('strips the full custom fileExtension from the tail', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [createSchema('Dog', 'schema')],
        routes: { default: 'models' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.model.ts',
        indexFiles: false,
        importPath: '@acme/models',
      });

      expect(plan.packageImportPath('Dog')).toBe(
        '@acme/models/models/dog.model',
      );
    });

    it('returns undefined when no importPath is set', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [createSchema('Pet', 'schema')],
        routes: { default: 'models' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.gen.ts',
        indexFiles: false,
      });

      expect(plan.packageImportPath('Pet')).toBeUndefined();
    });

    it('returns the barrel specifier when indexFiles is true', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [createSchema('Pet', 'schema')],
        routes: { default: 'models' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.gen.ts',
        indexFiles: true,
        importPath: '@acme/models',
      });

      // indexFiles routes every import through the root barrel
      expect(plan.packageImportPath('Pet')).toBe('@acme/models');
    });

    it('preserves default .ts extension as empty suffix', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [createSchema('User', 'schema')],
        routes: { default: 'models' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.ts',
        indexFiles: false,
        importPath: '@acme/models',
      });

      // .ts stripped by getImportExtension with no tsconfig → empty string
      expect(plan.packageImportPath('User')).toBe('@acme/models/models/user');
    });

    it('routes enum schemas through enum route for package import', () => {
      const plan = createSchemaOutputPlan({
        basePath,
        schemas: [
          createSchema('Status', 'enum'),
          createSchema('User', 'schema'),
        ],
        routes: { default: 'models', enum: 'enums' },
        namingConvention: NamingConvention.CAMEL_CASE,
        fileExtension: '.gen.ts',
        indexFiles: false,
        importPath: '@acme/models',
      });

      expect(plan.packageImportPath('Status')).toBe(
        '@acme/models/enums/status.gen',
      );
      expect(plan.packageImportPath('User')).toBe(
        '@acme/models/models/user.gen',
      );
    });
  });
});
