const {
  MAX_SCAN_NODES,
  SCAN_TREE_SCHEMA,
  normalizeScanTreeResult,
} = require('../../server/scanTree.cjs');

function node(id, parentId = null, overrides = {}) {
  return {
    id,
    kind: 'detail',
    parentId,
    text: `Card ${id}`,
    ...overrides,
  };
}

describe('scan tree validation', () => {
  it('normalizes text and orders parents before children', () => {
    const result = normalizeScanTreeResult({
      title: '  Book notes  ',
      nodes: [
        node('child', 'root'),
        node('root', null, { kind: 'main_idea' }),
        node('grandchild', 'child'),
      ],
    });

    expect(result.title).toBe('Book notes');
    expect(result.nodes.map((item) => item.id)).toEqual(['root', 'child', 'grandchild']);
  });

  it('accepts an empty tree for an unreadable image', () => {
    expect(normalizeScanTreeResult({
      title: 'No readable content',
      nodes: [],
    })).toEqual({
      title: 'No readable content',
      nodes: [],
    });
  });

  it('rejects duplicate IDs', () => {
    expect(() => normalizeScanTreeResult({
      title: 'Duplicate',
      nodes: [node('same'), node('same')],
    })).toThrow('Duplicate node ID');
  });

  it('rejects missing parents', () => {
    expect(() => normalizeScanTreeResult({
      title: 'Missing parent',
      nodes: [node('child', 'absent')],
    })).toThrow('references a missing parent');
  });

  it('rejects cycles', () => {
    expect(() => normalizeScanTreeResult({
      title: 'Cycle',
      nodes: [node('a', 'b'), node('b', 'a')],
    })).toThrow('contains a cycle');
  });

  it('rejects trees deeper than three generated levels', () => {
    expect(() => normalizeScanTreeResult({
      title: 'Too deep',
      nodes: [
        node('one'),
        node('two', 'one'),
        node('three', 'two'),
        node('four', 'three'),
      ],
    })).toThrow('cannot be deeper than 3');
  });

  it('rejects results above the node limit', () => {
    expect(() => normalizeScanTreeResult({
      title: 'Too many',
      nodes: Array.from({ length: MAX_SCAN_NODES + 1 }, (_, index) => node(`n${index}`)),
    })).toThrow(`more than ${MAX_SCAN_NODES}`);
  });

  it('defines a strict schema at every object level', () => {
    expect(SCAN_TREE_SCHEMA.additionalProperties).toBe(false);
    expect(SCAN_TREE_SCHEMA.properties.nodes.items.additionalProperties).toBe(false);
    expect(SCAN_TREE_SCHEMA.required).toEqual(['title', 'nodes']);
    expect(SCAN_TREE_SCHEMA.properties.nodes.items.required).toEqual([
      'id',
      'parentId',
      'text',
      'kind',
    ]);
  });
});
