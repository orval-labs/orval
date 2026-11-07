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

/**
 * Orders a graph by depth-first post-order. Only an edge to a node on the
 * current search path closes a cycle.
 */
export const orderByDependencies = (
  graph: DependencyGraph,
): DependencyOrder => {
  const visited = new Set<string>();
  const onPath = new Set<string>();
  const order: string[] = [];
  const cyclicEdges = new Map<string, Set<string>>();

  // Runs on an explicit stack, so the depth of a graph is not limited by the
  // call stack.
  const visit = (root: string): void => {
    const open = (node: string) => {
      visited.add(node);
      onPath.add(node);
      return { node, targets: (graph.get(node) ?? new Set<string>()).values() };
    };
    const stack = [open(root)];
    for (let frame = stack.at(-1); frame; frame = stack.at(-1)) {
      const next = frame.targets.next();
      if (next.done) {
        onPath.delete(frame.node);
        order.push(frame.node);
        stack.pop();
      } else if (onPath.has(next.value)) {
        withEdge(cyclicEdges, frame.node, next.value);
      } else if (!visited.has(next.value)) {
        stack.push(open(next.value));
      }
    }
  };

  for (const node of graph.keys()) {
    if (!visited.has(node)) visit(node);
  }

  return { order, cyclicEdges };
};
