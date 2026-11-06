/** Directed graph: each node id maps to the ids it points at. */
export type DependencyGraph = ReadonlyMap<string, ReadonlySet<string>>;

export interface DependencyOrder {
  /** Every node, dependencies first. */
  order: string[];
  /** Edges that close a cycle, by source node; only these may point forward. */
  cyclicEdges: ReadonlyMap<string, ReadonlySet<string>>;
}

const withEdge = (
  edges: Map<string, Set<string>>,
  from: string,
  to: string,
): void => {
  const targets = edges.get(from);
  if (targets) targets.add(to);
  else edges.set(from, new Set([to]));
};

interface DepthFirstHooks {
  /** A node is reached for the first time. */
  enter: (node: string) => void;
  /** An edge points at a node reached before. */
  revisit: (from: string, to: string) => void;
  /** All edges of a node are done; the parent is the node it was reached from. */
  exit: (node: string, parent: string | undefined) => void;
}

interface Frame {
  node: string;
  targets: Iterator<string>;
}

// Depth-first search over every node, on an explicit stack so the depth of a
// graph is not limited by the call stack.
const depthFirst = (graph: DependencyGraph, hooks: DepthFirstHooks): void => {
  const visited = new Set<string>();
  const open = (node: string): Frame => {
    visited.add(node);
    hooks.enter(node);
    return { node, targets: (graph.get(node) ?? new Set<string>()).values() };
  };

  for (const root of graph.keys()) {
    if (visited.has(root)) continue;
    const stack = [open(root)];
    for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
      const next = frame.targets.next();
      if (next.done) {
        stack.pop();
        hooks.exit(frame.node, stack.at(-1)?.node);
      } else if (visited.has(next.value)) {
        hooks.revisit(frame.node, next.value);
      } else {
        stack.push(open(next.value));
      }
    }
  }
};

/**
 * Orders a graph by depth-first post-order. Only an edge to a node on the
 * current search path closes a cycle.
 */
export const orderByDependencies = (
  graph: DependencyGraph,
): DependencyOrder => {
  const onPath = new Set<string>();
  const order: string[] = [];
  const cyclicEdges = new Map<string, Set<string>>();

  depthFirst(graph, {
    enter: (node) => {
      onPath.add(node);
    },
    revisit: (from, to) => {
      if (onPath.has(to)) withEdge(cyclicEdges, from, to);
    },
    exit: (node) => {
      onPath.delete(node);
      order.push(node);
    },
  });

  return { order, cyclicEdges };
};

/**
 * The nodes that lie on a cycle, found with Tarjan's algorithm: a component
 * of several nodes, or a node that points at itself.
 */
export const nodesOnCycles = (graph: DependencyGraph): Set<string> => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const open: string[] = [];
  const onOpen = new Set<string>();
  const cyclic = new Set<string>();

  const lowOf = (node: string): number => low.get(node) ?? 0;
  const lower = (node: string, value: number): void => {
    low.set(node, Math.min(lowOf(node), value));
  };

  const close = (node: string): void => {
    if (low.get(node) !== index.get(node)) return;
    const members: string[] = [];
    for (let member = open.pop(); member !== undefined; member = open.pop()) {
      onOpen.delete(member);
      members.push(member);
      if (member === node) break;
    }
    if (members.length > 1 || graph.get(node)?.has(node)) {
      for (const member of members) cyclic.add(member);
    }
  };

  depthFirst(graph, {
    enter: (node) => {
      index.set(node, index.size);
      low.set(node, index.get(node) ?? 0);
      open.push(node);
      onOpen.add(node);
    },
    revisit: (from, to) => {
      if (onOpen.has(to)) lower(from, index.get(to) ?? 0);
    },
    exit: (node, parent) => {
      close(node);
      if (parent !== undefined) lower(parent, lowOf(node));
    },
  });

  return cyclic;
};
