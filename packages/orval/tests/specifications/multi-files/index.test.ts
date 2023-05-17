import { describe, it, expect } from 'vitest';
import { run } from '../../testing-helper';

describe('multi-files', () => {
  it('correct request body', async () => {
    const results = await run(`${__dirname}/request-body.yaml`);
    expect(results.allType).not.include('unknown');
    expect(results.allType).not.include('owner?:');
    // Optional name is in only schemas directories file. Pet and Person.
    expect(results.allType.match(/name\?: string;/g)?.length).toBe(2);
    // Other name is required.
    expect(results.allType.match(/name: string;/g)?.length).toBe(3);
    // Deprecated in owner properties description
    expect(results.allType.match(/@deprecated/g)?.length).toBe(2);
  });
  it('correct response', async () => {
    const results = await run(`${__dirname}/response.yaml`);
    expect(results.allType).not.include('unknown');
    expect(results.allType).not.include('owner?:');
    // Optional name is in only schemas directories file. Pet and Person.
    expect(results.allType.match(/name\?: string;/g)?.length).toBe(2);
    // Other name is required.
    expect(results.allType.match(/name: string;/g)?.length).toBe(3);
    // Deprecated in owner properties description
    expect(results.allType.match(/@deprecated/g)?.length).toBe(2);
  });
});
