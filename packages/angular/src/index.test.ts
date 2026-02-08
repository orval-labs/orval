import { describe, expect, it } from 'vitest';

import { builder } from './index';

// ---------------------------------------------------------------------------
// builder – factory mode selection
// ---------------------------------------------------------------------------

describe('builder', () => {
  it('returns httpClientBuilder when no options are provided', () => {
    const result = builder()();
    expect(result.client).toBeDefined();
    expect(result.header).toBeDefined();
    expect(result.footer).toBeDefined();
    expect(result).not.toHaveProperty('extraFiles');
  });

  it('returns httpClientBuilder for client "httpClient"', () => {
    const result = builder()({ client: 'httpClient' });
    expect(result).not.toHaveProperty('extraFiles');
  });

  it('returns httpResourceBuilder for client "httpResource"', () => {
    const result = builder()({ client: 'httpResource' });
    expect(result.client).toBeDefined();
    expect(result.header).toBeDefined();
    expect(result.footer).toBeDefined();
    expect(result).not.toHaveProperty('extraFiles');
  });

  it('returns bothClientBuilder for client "both"', () => {
    const result = builder()({ client: 'both' });
    expect(result.extraFiles).toBeDefined();
    expect(result.client).toBeDefined();
  });

  it('uses the same title generator across all modes', () => {
    const httpClient = builder()({ client: 'httpClient' });
    const httpResource = builder()({ client: 'httpResource' });
    const both = builder()({ client: 'both' });

    expect(httpClient.title).toBe(httpResource.title);
    expect(httpResource.title).toBe(both.title);
  });

  it('httpResource and httpClient use different client generators', () => {
    const httpClient = builder()({ client: 'httpClient' });
    const httpResource = builder()({ client: 'httpResource' });

    expect(httpClient.client).not.toBe(httpResource.client);
    expect(httpClient.header).not.toBe(httpResource.header);
    expect(httpClient.footer).not.toBe(httpResource.footer);
  });

  it('"both" mode uses httpClient client generator with extraFiles', () => {
    const httpClient = builder()({ client: 'httpClient' });
    const both = builder()({ client: 'both' });

    expect(both.client).toBe(httpClient.client);
    expect(both.header).toBe(httpClient.header);
    expect(both.footer).toBe(httpClient.footer);
    expect(both.extraFiles).toBeDefined();
  });
});
