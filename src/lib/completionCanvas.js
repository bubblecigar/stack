export const VOID_COMPLETION_OUTCOME = 'void';

export function isVoidCompletionNode(node) {
  return node?.outcome === VOID_COMPLETION_OUTCOME;
}

export function countCompletedCanvasNodes(nodes) {
  return (Array.isArray(nodes) ? nodes : [])
    .filter((node) => !isVoidCompletionNode(node))
    .length;
}
