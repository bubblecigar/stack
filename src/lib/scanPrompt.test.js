import { SCAN_CARDS_PROMPT, SCAN_PROMPT_VERSION } from './scanPrompt';

describe('scan prompt', () => {
  it('stays within the client-to-server prompt limit', () => {
    expect(SCAN_CARDS_PROMPT.length).toBeLessThanOrEqual(4000);
  });

  it('captures the reading-tree quality constraints', () => {
    expect(SCAN_PROMPT_VERSION).toBe('reading-tree-v2');
    expect(SCAN_CARDS_PROMPT).toContain('8 to 20 cards');
    expect(SCAN_CARDS_PROMPT).toContain('Never exceed 30 cards');
    expect(SCAN_CARDS_PROMPT).toContain('no more than 3 generated levels');
    expect(SCAN_CARDS_PROMPT).toContain('do not create one card for every sentence');
    expect(SCAN_CARDS_PROMPT).toContain('Preserve names, terminology, formulas');
    expect(SCAN_CARDS_PROMPT).toContain('do not make a heading-only card');
    expect(SCAN_CARDS_PROMPT).toContain('question only when the source itself asks');
  });
});
