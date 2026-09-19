import {
  completeTutorialStep,
  EMPTY_TUTORIAL_PROGRESS,
  FIRST_CARD_DELETE_STEP,
  FIRST_CARD_FOCUS_STEP,
  hasCompletedTutorialStep,
  normalizeTutorialProgress,
} from './tutorialProgress';

describe('tutorial progress', () => {
  it('normalizes missing and duplicate progress', () => {
    expect(normalizeTutorialProgress(null)).toEqual(EMPTY_TUTORIAL_PROGRESS);
    expect(normalizeTutorialProgress({
      completedSteps: [FIRST_CARD_FOCUS_STEP, FIRST_CARD_FOCUS_STEP, null],
    })).toEqual({
      schemaVersion: 1,
      completedSteps: [FIRST_CARD_FOCUS_STEP],
    });
  });

  it('completes a tutorial step once', () => {
    const completed = completeTutorialStep(EMPTY_TUTORIAL_PROGRESS, FIRST_CARD_FOCUS_STEP);

    expect(hasCompletedTutorialStep(completed, FIRST_CARD_FOCUS_STEP)).toBe(true);
    expect(completeTutorialStep(completed, FIRST_CARD_FOCUS_STEP)).toEqual(completed);
  });

  it('tracks the delete tutorial separately from insertion', () => {
    const afterInsertion = completeTutorialStep(
      EMPTY_TUTORIAL_PROGRESS,
      FIRST_CARD_FOCUS_STEP,
    );
    const afterDelete = completeTutorialStep(afterInsertion, FIRST_CARD_DELETE_STEP);

    expect(hasCompletedTutorialStep(afterInsertion, FIRST_CARD_DELETE_STEP)).toBe(false);
    expect(hasCompletedTutorialStep(afterDelete, FIRST_CARD_DELETE_STEP)).toBe(true);
  });
});
