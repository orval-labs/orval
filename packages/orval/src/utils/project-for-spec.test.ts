import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it } from 'vite-plus/test';

import { generateSpecContent } from '../generate-spec-content';
import { loadProjectForSpec } from './project-for-spec';

const SPEC = JSON.stringify({
  openapi: '3.1.0',
  info: { title: 'Petstore', version: '1.0.0' },
  paths: {},
  components: {
    schemas: {
      Pet: { type: 'object', properties: { name: { type: 'string' } } },
    },
  },
});

describe('loadProjectForSpec', () => {
  let workspace: string;
  let configFile: string;

  const writeConfig = (projects: Record<string, unknown>) =>
    fs.writeFile(configFile, `export default ${JSON.stringify(projects)};\n`);

  beforeEach(async () => {
    workspace = await fs.realpath(
      await fs.mkdtemp(path.join(os.tmpdir(), 'orval-project-for-spec-')),
    );
    configFile = path.join(workspace, 'orval.config.mjs');
    await fs.mkdir(path.join(workspace, 'specs'));
    await fs.writeFile(path.join(workspace, 'specs/pets.json'), SPEC);
    await fs.writeFile(path.join(workspace, 'specs/users.json'), SPEC);
  });

  afterEach(async () => {
    await fs.rm(workspace, { recursive: true, force: true });
  });

  it('selects the project whose input is the spec', async () => {
    await writeConfig({
      users: { input: './specs/users.json', output: './users.ts' },
      pets: { input: { target: './specs/pets.json' }, output: './pets.ts' },
    });

    const project = await loadProjectForSpec(
      path.join(workspace, 'specs/pets.json'),
      { config: configFile },
    );

    expect(project.projectName).toBe('pets');
    expect(project.workspace).toBe(workspace);
    expect(project.options.input.target).toBe(
      path.join(workspace, 'specs/pets.json'),
    );
  });

  it('matches a spec path relative to the current directory', async () => {
    await writeConfig({
      pets: { input: './specs/pets.json', output: './pets.ts' },
    });

    const project = await loadProjectForSpec(
      path.relative(process.cwd(), path.join(workspace, 'specs/pets.json')),
      { config: configFile },
    );

    expect(project.projectName).toBe('pets');
  });

  it('fails when no project reads the spec', async () => {
    await writeConfig({
      users: { input: './specs/users.json', output: './users.ts' },
    });

    await expect(
      loadProjectForSpec(path.join(workspace, 'specs/pets.json'), {
        config: configFile,
      }),
    ).rejects.toThrow(/No project in .* has .*pets\.json as its input/);
  });

  it('fails when several projects read the spec', async () => {
    await writeConfig({
      a: { input: './specs/pets.json', output: './a.ts' },
      b: { input: './specs/pets.json', output: './b.ts' },
    });

    await expect(
      loadProjectForSpec(path.join(workspace, 'specs/pets.json'), {
        config: configFile,
      }),
    ).rejects.toThrow(/as their input: a, b\./);
  });

  it('selects one of several projects by name', async () => {
    await writeConfig({
      a: { input: './specs/pets.json', output: './a.ts' },
      b: { input: './specs/pets.json', output: './b.ts' },
    });

    const project = await loadProjectForSpec(
      path.join(workspace, 'specs/pets.json'),
      { config: configFile, project: 'b' },
    );

    expect(project.projectName).toBe('b');
  });

  it.each([
    ['is unknown', 'missing', /Project not found in .*: missing/],
    ['reads another spec', 'users', /Project users in .* does not have/],
  ])('fails when the named project %s', async (_name, project, error) => {
    await writeConfig({
      pets: { input: './specs/pets.json', output: './pets.ts' },
      users: { input: './specs/users.json', output: './users.ts' },
    });

    await expect(
      loadProjectForSpec(path.join(workspace, 'specs/pets.json'), {
        config: configFile,
        project,
      }),
    ).rejects.toThrow(error);
  });

  it('feeds generateSpecContent', async () => {
    await writeConfig({
      pets: { input: './specs/pets.json', output: './pets.ts' },
    });

    const {
      workspace: projectWorkspace,
      options,
      projectName,
    } = await loadProjectForSpec(path.join(workspace, 'specs/pets.json'), {
      config: configFile,
    });

    expect(
      await generateSpecContent(projectWorkspace, options, projectName),
    ).toContain('export interface Pet {');
  });
});
