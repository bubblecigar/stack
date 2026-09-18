import {
  countCompletedCanvasNodes,
  isVoidCompletionNode,
  VOID_COMPLETION_OUTCOME,
} from './completionCanvas';

describe('completion canvas outcomes', () => {
  it('treats legacy and done nodes as completions while excluding void nodes', () => {
    expect(countCompletedCanvasNodes([
      { id: 'legacy' },
      { id: 'done', outcome: 'done' },
      { id: 'void', outcome: VOID_COMPLETION_OUTCOME },
    ])).toBe(2);
  });

  it('identifies only explicit void outcomes', () => {
    expect(isVoidCompletionNode({ outcome: VOID_COMPLETION_OUTCOME })).toBe(true);
    expect(isVoidCompletionNode({ outcome: 'done' })).toBe(false);
    expect(isVoidCompletionNode({})).toBe(false);
  });
});
