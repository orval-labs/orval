import { describe, expect, it } from 'vite-plus/test';

import { getUnknownMutationInvalidatesWarnings } from './mutation-invalidates';

const operationNames = ['getNotes', 'postNotes', 'deleteNote'];

const warningsFor = (
  mutationInvalidates: Parameters<
    typeof getUnknownMutationInvalidatesWarnings
  >[0]['mutationInvalidates'],
) =>
  getUnknownMutationInvalidatesWarnings({
    mutationInvalidates,
    operationNames,
  });

describe('getUnknownMutationInvalidatesWarnings', () => {
  it('returns nothing when the option is not configured', () => {
    expect(warningsFor(undefined)).toStrictEqual([]);
    expect(warningsFor([])).toStrictEqual([]);
  });

  it('returns nothing when every reference resolves', () => {
    expect(
      warningsFor([
        { onMutations: ['postNotes'], invalidates: ['getNotes'] },
        { onMutations: ['deleteNote'], invalidates: [{ query: 'getNotes' }] },
      ]),
    ).toStrictEqual([]);
  });

  // `onMutations` is matched with `===` against the generated operation name,
  // so the raw operationId casing of the OpenAPI document never matches and the
  // whole rule is a silent no-op. This is the case #4166 was filed for.
  it('warns for an unknown onMutations entry and suggests the generated name', () => {
    const [warning, ...rest] = warningsFor([
      { onMutations: ['PostNotes'], invalidates: ['getNotes'] },
    ]);

    expect(rest).toStrictEqual([]);
    expect(warning).toContain('onMutations');
    expect(warning).toContain("'PostNotes'");
    expect(warning).toContain("did you mean 'postNotes'?");
  });

  it('warns for an unknown invalidates entry', () => {
    const [warning, ...rest] = warningsFor([
      { onMutations: ['postNotes'], invalidates: ['getNote'] },
    ]);

    expect(rest).toStrictEqual([]);
    expect(warning).toContain('invalidates');
    expect(warning).toContain("'getNote'");
  });

  it('reads the query name out of an object-form invalidate target', () => {
    const [warning, ...rest] = warningsFor([
      {
        onMutations: ['postNotes'],
        invalidates: [{ query: 'getNote', params: ['noteId'] }],
      },
    ]);

    expect(rest).toStrictEqual([]);
    expect(warning).toContain("'getNote'");
  });

  // `invalidates` folds its target through `camel()` to build the query key
  // function name, so the raw operationId casing resolves to the same function
  // and is a working reference. Warning here would be a false positive.
  it('accepts the raw operationId casing in invalidates', () => {
    expect(
      warningsFor([{ onMutations: ['postNotes'], invalidates: ['GetNotes'] }]),
    ).toStrictEqual([]);
  });

  it('omits the suggestion when no operation resembles the reference', () => {
    const [warning] = warningsFor([
      { onMutations: ['listInvoices'], invalidates: ['getNotes'] },
    ]);

    expect(warning).toContain("'listInvoices'");
    expect(warning).not.toContain('did you mean');
  });

  it('reports one warning per unknown name however many rules repeat it', () => {
    expect(
      warningsFor([
        { onMutations: ['PostNotes'], invalidates: ['getNotes'] },
        { onMutations: ['PostNotes'], invalidates: ['getNotes'] },
      ]),
    ).toHaveLength(1);
  });

  it('reports the same name separately per field, since the rules differ', () => {
    expect(
      warningsFor([{ onMutations: ['getNote'], invalidates: ['getNote'] }]),
    ).toHaveLength(2);
  });

  it('reports every distinct unknown name', () => {
    expect(
      warningsFor([
        { onMutations: ['PostNotes', 'PatchNotes'], invalidates: ['getNotes'] },
      ]),
    ).toHaveLength(2);
  });

  it('warns when the output has no operations at all', () => {
    expect(
      getUnknownMutationInvalidatesWarnings({
        mutationInvalidates: [
          { onMutations: ['postNotes'], invalidates: ['getNotes'] },
        ],
        operationNames: [],
      }),
    ).toHaveLength(2);
  });
});
