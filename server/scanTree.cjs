const MAX_SCAN_NODES = 30;
const MAX_SCAN_DEPTH = 3;
const MAX_SCAN_NODE_ID_LENGTH = 64;
const MAX_SCAN_NODE_TEXT_LENGTH = 1200;
const MAX_SCAN_TITLE_LENGTH = 200;
const SCAN_NODE_KINDS = Object.freeze([
  'main_idea',
  'explanation',
  'detail',
  'example',
  'definition',
  'question',
]);

const SCAN_TREE_SCHEMA = Object.freeze({
  type: 'object',
  properties: {
    title: {
      type: 'string',
      description: 'A concise title for the photographed material.',
    },
    nodes: {
      type: 'array',
      description: 'Reading cards connected into a hierarchy with temporary IDs.',
      items: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            description: 'A unique temporary ID for this node, such as n1.',
          },
          parentId: {
            anyOf: [
              { type: 'string' },
              { type: 'null' },
            ],
            description: 'The temporary ID of the parent node, or null for a top-level idea.',
          },
          text: {
            type: 'string',
            description: 'One concise, independently readable thought from the source.',
          },
          kind: {
            type: 'string',
            enum: SCAN_NODE_KINDS,
          },
        },
        required: ['id', 'parentId', 'text', 'kind'],
        additionalProperties: false,
      },
    },
  },
  required: ['title', 'nodes'],
  additionalProperties: false,
});

class ScanTreeValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ScanTreeValidationError';
  }
}

function normalizeRequiredText(value, fieldName, maxLength) {
  const text = typeof value === 'string' ? value.trim() : '';
  if (!text) {
    throw new ScanTreeValidationError(`${fieldName} must be a non-empty string.`);
  }

  if (text.length > maxLength) {
    throw new ScanTreeValidationError(`${fieldName} is too long.`);
  }

  return text;
}

function normalizeScanTreeResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ScanTreeValidationError('Scan result must be an object.');
  }

  const title = normalizeRequiredText(value.title, 'title', MAX_SCAN_TITLE_LENGTH);
  if (!Array.isArray(value.nodes)) {
    throw new ScanTreeValidationError('nodes must be an array.');
  }

  if (value.nodes.length > MAX_SCAN_NODES) {
    throw new ScanTreeValidationError(`nodes cannot contain more than ${MAX_SCAN_NODES} items.`);
  }

  const nodeById = new Map();
  const normalizedNodes = value.nodes.map((rawNode, index) => {
    if (!rawNode || typeof rawNode !== 'object' || Array.isArray(rawNode)) {
      throw new ScanTreeValidationError(`nodes[${index}] must be an object.`);
    }

    const id = normalizeRequiredText(
      rawNode.id,
      `nodes[${index}].id`,
      MAX_SCAN_NODE_ID_LENGTH,
    );
    if (nodeById.has(id)) {
      throw new ScanTreeValidationError(`Duplicate node ID: ${id}.`);
    }

    const parentId = rawNode.parentId === null
      ? null
      : normalizeRequiredText(
        rawNode.parentId,
        `nodes[${index}].parentId`,
        MAX_SCAN_NODE_ID_LENGTH,
      );
    const text = normalizeRequiredText(
      rawNode.text,
      `nodes[${index}].text`,
      MAX_SCAN_NODE_TEXT_LENGTH,
    );
    const kind = typeof rawNode.kind === 'string' ? rawNode.kind.trim() : '';
    if (!SCAN_NODE_KINDS.includes(kind)) {
      throw new ScanTreeValidationError(`nodes[${index}].kind is invalid.`);
    }

    const node = {
      id,
      parentId,
      text,
      kind,
      sourceIndex: index,
    };
    nodeById.set(id, node);
    return node;
  });

  normalizedNodes.forEach((node) => {
    if (node.parentId === node.id) {
      throw new ScanTreeValidationError(`Node ${node.id} cannot be its own parent.`);
    }

    if (node.parentId !== null && !nodeById.has(node.parentId)) {
      throw new ScanTreeValidationError(`Node ${node.id} references a missing parent.`);
    }
  });

  const depthById = new Map();
  const visitingIds = new Set();

  function getNodeDepth(node) {
    if (depthById.has(node.id)) {
      return depthById.get(node.id);
    }

    if (visitingIds.has(node.id)) {
      throw new ScanTreeValidationError('Scan tree contains a cycle.');
    }

    visitingIds.add(node.id);
    const depth = node.parentId === null
      ? 1
      : getNodeDepth(nodeById.get(node.parentId)) + 1;
    visitingIds.delete(node.id);

    if (depth > MAX_SCAN_DEPTH) {
      throw new ScanTreeValidationError(
        `Scan tree cannot be deeper than ${MAX_SCAN_DEPTH} generated levels.`,
      );
    }

    depthById.set(node.id, depth);
    return depth;
  }

  normalizedNodes.forEach(getNodeDepth);

  const nodes = [...normalizedNodes]
    .sort((left, right) => (
      getNodeDepth(left) - getNodeDepth(right)
      || left.sourceIndex - right.sourceIndex
    ))
    .map(({ sourceIndex: _sourceIndex, ...node }) => node);

  return { title, nodes };
}

module.exports = {
  MAX_SCAN_DEPTH,
  MAX_SCAN_NODES,
  SCAN_NODE_KINDS,
  SCAN_TREE_SCHEMA,
  ScanTreeValidationError,
  normalizeScanTreeResult,
};
