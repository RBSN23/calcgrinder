// PROJ-16 — remark plugin: remap H1 source nodes to H2.
//
// H1 is reserved for the calculator hero per Calcgrinder-spec.md.
// Maintainers writing `# Heading` inside a text-block source see it
// rendered as <h2> instead of <h1>. The plugin walks the mdast and
// promotes any depth-1 heading to depth-2 in-place; deeper headings
// pass through unchanged.

import type { Root, Heading } from 'mdast';
import { visit } from 'unist-util-visit';

export function h1ToH2() {
  return (tree: Root) => {
    visit(tree, 'heading', (node: Heading) => {
      if (node.depth === 1) node.depth = 2;
    });
  };
}
