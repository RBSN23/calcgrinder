import { describe, expect, it } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import type { Heading, Root } from 'mdast';
import { visit } from 'unist-util-visit';

import { h1ToH2 } from './h1-to-h2';

function parse(markdown: string): Root {
  return unified().use(remarkParse).parse(markdown) as Root;
}

function applyPlugin(markdown: string): Root {
  const tree = parse(markdown);
  h1ToH2()(tree);
  return tree;
}

function headingDepths(tree: Root): number[] {
  const depths: number[] = [];
  visit(tree, 'heading', (node: Heading) => depths.push(node.depth));
  return depths;
}

describe('h1ToH2 remark plugin', () => {
  it('promotes a single H1 to H2', () => {
    const tree = applyPlugin('# Title');
    expect(headingDepths(tree)).toEqual([2]);
  });

  it('leaves H2/H3/H4 untouched', () => {
    const tree = applyPlugin('## Two\n\n### Three\n\n#### Four');
    expect(headingDepths(tree)).toEqual([2, 3, 4]);
  });

  it('promotes H1s but leaves deeper headings alone in mixed content', () => {
    const tree = applyPlugin('# First\n\n## Sub\n\n# Second\n\n### Deep');
    expect(headingDepths(tree)).toEqual([2, 2, 2, 3]);
  });

  it('produces no headings when source has no headings', () => {
    const tree = applyPlugin('Just paragraph text.');
    expect(headingDepths(tree)).toEqual([]);
  });

  it('roundtrip via remark-stringify renders a level-2 heading', () => {
    const tree = applyPlugin('# Hello');
    const output = unified().use(remarkStringify).stringify(tree);
    expect(output.trim()).toBe('## Hello');
  });
});
