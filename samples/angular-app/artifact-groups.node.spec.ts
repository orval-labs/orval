import { describe, expect, it, vi } from 'vite-plus/test';

// Records every Angular module that gets imported, so a leak between groups
// shows up as a name in this list.
const loaded = vi.hoisted(() => new Set<string>());

vi.mock('@angular/core', async (importOriginal) => {
  loaded.add('@angular/core');
  return importOriginal();
});
vi.mock('@angular/common/http', async (importOriginal) => {
  loaded.add('@angular/common/http');
  return importOriginal();
});

describe('artifact groups', () => {
  it('loads the MSW barrel without loading Angular', async () => {
    const msw = await import('./src/api/artifact-groups/msw/index.msw');

    expect(msw.getPetsMock().length).toBeGreaterThan(0);
    expect([...loaded]).toEqual([]);
  });

  it('loads the Faker barrel without loading Angular', async () => {
    const faker = await import('./src/api/artifact-groups/faker/index.faker');

    expect(faker.getListPetsResponseMock().length).toBeGreaterThan(0);
    expect(faker.getPetMock().name).toEqual(expect.any(String));
    expect([...loaded]).toEqual([]);
  });

  // Runs last: once Angular is loaded, the checks above would prove nothing.
  // The import itself fails in plain Node (Angular wants its JIT compiler),
  // which is the failure the group split avoids.
  it('records Angular when the client barrel is loaded', async () => {
    await import('./src/api/artifact-groups/angular/index').catch(() => {});

    expect(loaded.size).toBeGreaterThan(0);
  });
});
