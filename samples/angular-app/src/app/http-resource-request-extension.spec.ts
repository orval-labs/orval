import { HttpContext, HttpContextToken, HttpHeaders } from '@angular/common/http';

import {
  applyOrvalRequestExtension,
  type OrvalHttpResourceRequestExtension,
} from '../api/http-resource/pets/pets.service';

// Exercises the emitted `applyOrvalRequestExtension`/`mergeOrvalResourceHeaders`
// runtime helpers directly (see #3710). These are asserted only as substrings
// of generated text elsewhere (tests/api-generation.spec.ts); this file
// verifies the actual merge/precedence/short-circuit behavior at runtime.
//
// This file lives under `src/app` (hand-written code), not under the
// `output.clean: true` generated `src/api/http-resource` directory, so
// regenerating the sample API does not delete it.
describe('applyOrvalRequestExtension (generated runtime helper)', () => {
  it('short-circuits and returns the base request unchanged when no options are given', () => {
    const base = { url: '/pets' };

    expect(applyOrvalRequestExtension(base)).toBe(base);
    expect(applyOrvalRequestExtension(base, {})).toBe(base);
    expect(
      applyOrvalRequestExtension(base, {
        headers: undefined,
        context: undefined,
        request: undefined,
      }),
    ).toBe(base);
  });

  it('normalizes a bare URL string request into an HttpResourceRequest', () => {
    const result = applyOrvalRequestExtension('/pets', {
      headers: { 'X-Extra': 'e' },
    });

    expect(result.url).toBe('/pets');
    expect(result.headers).toEqual({ 'X-Extra': 'e' });
  });

  it('merges record-over-record headers, with the extension winning on key conflicts', () => {
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: { 'X-Base': 'b', 'X-Only-Base': 'ob' } },
      { headers: { 'X-Base': 'override', 'X-Only-Extra': 'oe' } },
    );

    expect(result.headers).toEqual({
      'X-Base': 'override',
      'X-Only-Base': 'ob',
      'X-Only-Extra': 'oe',
    });
  });

  it('merges an HttpHeaders base with a record extension into HttpHeaders', () => {
    const base = new HttpHeaders().set('X-Base', 'b');
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: base },
      { headers: { 'X-Extra': 'e', 'X-Base': 'override' } },
    );

    expect(result.headers).toBeInstanceOf(HttpHeaders);
    const headers = result.headers as HttpHeaders;
    expect(headers.get('X-Base')).toBe('override');
    expect(headers.get('X-Extra')).toBe('e');
  });

  it('merges a record base with an HttpHeaders extension into HttpHeaders', () => {
    const extra = new HttpHeaders().set('X-Extra', 'e');
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: { 'X-Base': 'b' } },
      { headers: extra },
    );

    expect(result.headers).toBeInstanceOf(HttpHeaders);
    const headers = result.headers as HttpHeaders;
    expect(headers.get('X-Base')).toBe('b');
    expect(headers.get('X-Extra')).toBe('e');
  });

  it('merges HttpHeaders base and HttpHeaders extension, preserving multi-value headers', () => {
    const base = new HttpHeaders().set('X-Base', 'b');
    const extra = new HttpHeaders().append('X-Multi', 'a').append('X-Multi', 'b');
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: base },
      { headers: extra },
    );

    expect(result.headers).toBeInstanceOf(HttpHeaders);
    const headers = result.headers as HttpHeaders;
    expect(headers.get('X-Base')).toBe('b');
    expect(headers.getAll('X-Multi')).toEqual(['a', 'b']);
  });

  it('takes the extension headers as-is when the base request has none', () => {
    const result = applyOrvalRequestExtension('/pets', {
      headers: { 'X-Extra': 'e' },
    });

    expect(result.headers).toEqual({ 'X-Extra': 'e' });
  });

  it('keeps the base headers as-is when the extension supplies none', () => {
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: { 'X-Base': 'b' } },
      { context: new HttpContext() },
    );

    expect(result.headers).toEqual({ 'X-Base': 'b' });
  });

  it('invokes the function form of headers and merges its return value', () => {
    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: { 'X-Base': 'b' } },
      { headers: () => ({ 'X-Extra': 'from-fn' }) },
    );

    expect(result.headers).toEqual({ 'X-Base': 'b', 'X-Extra': 'from-fn' });
  });

  it('passes through a static HttpContext', () => {
    const token = new HttpContextToken(() => false);
    const context = new HttpContext().set(token, true);

    const result = applyOrvalRequestExtension({ url: '/pets' }, { context });

    expect(result.context).toBe(context);
    expect(result.context?.get(token)).toBe(true);
  });

  it('invokes the function form of context', () => {
    const token = new HttpContextToken(() => false);

    const result = applyOrvalRequestExtension(
      { url: '/pets' },
      { context: () => new HttpContext().set(token, true) },
    );

    expect(result.context?.get(token)).toBe(true);
  });

  it('runs the request escape hatch last, after headers/context are merged', () => {
    const options: OrvalHttpResourceRequestExtension = {
      headers: { 'X-Extra': 'e' },
      context: new HttpContext(),
      request: (req) => ({
        ...req,
        headers: req.headers,
        reportProgress: true,
      }),
    };

    const result = applyOrvalRequestExtension(
      { url: '/pets', headers: { 'X-Base': 'b' } },
      options,
    );

    expect(result.reportProgress).toBe(true);
    expect(result.headers).toEqual({ 'X-Base': 'b', 'X-Extra': 'e' });
    expect(result.context).toBeInstanceOf(HttpContext);
  });
});
