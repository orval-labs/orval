import { describe, expect, it } from 'vite-plus/test';

import {
  type DependencyGraph,
  orderByDependencies,
} from './strongly-connected';

const graphOf = (edges: Record<string, string[]>): DependencyGraph =>
  new Map(Object.entries(edges).map(([node, to]) => [node, new Set(to)]));

const isCyclic = (
  cyclicEdges: ReadonlyMap<string, ReadonlySet<string>>,
  from: string,
  to: string,
) => cyclicEdges.get(from)?.has(to) ?? false;

// Every edge that is not cyclic must point at an earlier node.
const expectSafeOrder = (graph: DependencyGraph) => {
  const { order, cyclicEdges } = orderByDependencies(graph);
  expect(new Set(order).size).toBe(order.length);
  for (const [from, targets] of graph) {
    for (const to of targets) {
      if (!isCyclic(cyclicEdges, from, to)) {
        expect(order.indexOf(to)).toBeLessThan(order.indexOf(from));
      }
    }
  }
  return { order, cyclicEdges };
};

describe('orderByDependencies', () => {
  it('puts dependencies before their dependents', () => {
    const { order, cyclicEdges } = expectSafeOrder(
      graphOf({ a: ['b', 'c'], b: ['c'], c: [] }),
    );
    expect(order).toEqual(['c', 'b', 'a']);
    expect(cyclicEdges.size).toBe(0);
  });

  it('marks a self-loop as cyclic', () => {
    const { cyclicEdges } = expectSafeOrder(graphOf({ a: ['a'] }));
    expect(isCyclic(cyclicEdges, 'a', 'a')).toBe(true);
  });

  it('breaks a two-node cycle with one back-edge', () => {
    const { cyclicEdges } = expectSafeOrder(graphOf({ a: ['b'], b: ['a'] }));
    const marked = [...cyclicEdges.values()].reduce(
      (count, targets) => count + targets.size,
      0,
    );
    expect(marked).toBe(1);
  });

  it('breaks a three-node cycle', () => {
    const { cyclicEdges } = expectSafeOrder(
      graphOf({ a: ['b'], b: ['c'], c: ['a'] }),
    );
    expect(isCyclic(cyclicEdges, 'c', 'a')).toBe(true);
  });

  it('keeps a chord inside a cycle safe', () => {
    expectSafeOrder(graphOf({ a: ['b', 'c'], b: ['c'], c: ['a', 'b'] }));
  });

  it('does not mark forward or cross edges inside a cycle as cyclic', () => {
    const { cyclicEdges } = expectSafeOrder(
      graphOf({ a: ['b', 'c'], b: ['c'], c: ['a'] }),
    );
    expect(isCyclic(cyclicEdges, 'c', 'a')).toBe(true);
    expect(isCyclic(cyclicEdges, 'a', 'c')).toBe(false);
    expect(isCyclic(cyclicEdges, 'b', 'c')).toBe(false);
    expect(isCyclic(cyclicEdges, 'a', 'b')).toBe(false);
  });

  it('only marks edges to nodes on the search path', () => {
    const { cyclicEdges } = expectSafeOrder(
      graphOf({ a: ['b', 'c'], b: ['d'], c: ['d'], d: ['b'] }),
    );
    expect(isCyclic(cyclicEdges, 'd', 'b')).toBe(true);
    expect(isCyclic(cyclicEdges, 'c', 'd')).toBe(false);
  });

  it('orders a node that feeds a cycle after it', () => {
    const { order } = expectSafeOrder(
      graphOf({ root: ['a'], a: ['b'], b: ['a'] }),
    );
    expect(order.at(-1)).toBe('root');
  });

  it('treats targets outside the graph as leaves', () => {
    const { order } = orderByDependencies(graphOf({ a: ['missing'] }));
    expect(order).toEqual(['missing', 'a']);
  });

  it('handles a long chain', () => {
    const edges = Object.fromEntries(
      Array.from({ length: 3000 }, (_, i) => [`n${i}`, [`n${i + 1}`]]),
    );
    edges.n3000 = [];
    expect(orderByDependencies(graphOf(edges)).order).toHaveLength(3001);
  });

  it('handles a chain deeper than the call stack', () => {
    const length = 20_000;
    const edges = Object.fromEntries(
      Array.from({ length }, (_, i) => [`n${i}`, [`n${i + 1}`]]),
    );
    edges[`n${length}`] = [`n0`];
    const { order, cyclicEdges } = orderByDependencies(graphOf(edges));
    expect(order).toHaveLength(length + 1);
    expect(order[0]).toBe(`n${length}`);
    expect(isCyclic(cyclicEdges, `n${length}`, 'n0')).toBe(true);
  });
});
