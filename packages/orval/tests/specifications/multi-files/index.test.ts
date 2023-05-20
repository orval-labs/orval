import { describe, it, expect } from 'vitest';
import { run } from '../../testing-helper';

describe('multi-files', () => {
  const expects = (allType: string) => {
    expect(allType).not.include('unknown');
    expect(allType).not.include('owner?:');
    // Optional name is in only schemas directories file. Pet and Person.
    expect(allType.match(/name\?: string;/g)?.length).toBe(2);
    // Other name is required.
    expect(allType.match(/name: string;/g)?.length).toBe(3);
    // Deprecated in owner properties description
    expect(allType.match(/@deprecated/g)?.length).toBe(2);
  };

  it('correct request-body', async () => {
    const results = await run(`${__dirname}/request-body.yaml`);
    expects(results.allType);
  });
  it('correct response', async () => {
    const results = await run(`${__dirname}/response.yaml`);
    expects(results.allType);
  });
  it('correct components-schemas', async () => {
    const results = await run(`${__dirname}/components-schemas.yaml`);
    expects(results.allType);
  });
  it('correct components-responses', async () => {
    const results = await run(`${__dirname}/components-responses.yaml`);
    expects(results.allType);
  });
  it('correct components-request-bodies', async () => {
    const results = await run(`${__dirname}/components-request-bodies.yaml`);
    expects(results.allType);
  });
});
