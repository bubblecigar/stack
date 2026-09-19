export const TUTORIAL_PROGRESS_KEY = 'tutorialProgress:v1';
export const FIRST_CARD_FOCUS_STEP = 'first-card-focus';
export const FIRST_CARD_DELETE_STEP = 'first-card-delete';

export const EMPTY_TUTORIAL_PROGRESS = Object.freeze({
  schemaVersion: 1,
  completedSteps: [],
});

export function normalizeTutorialProgress(value) {
  const completedSteps = Array.isArray(value?.completedSteps)
    ? [...new Set(value.completedSteps.filter((step) => typeof step === 'string'))]
    : [];

  return {
    schemaVersion: 1,
    completedSteps,
  };
}

export function hasCompletedTutorialStep(progress, step) {
  return normalizeTutorialProgress(progress).completedSteps.includes(step);
}

export function completeTutorialStep(progress, step) {
  const normalized = normalizeTutorialProgress(progress);
  if (normalized.completedSteps.includes(step)) {
    return normalized;
  }

  return {
    ...normalized,
    completedSteps: [...normalized.completedSteps, step],
  };
}
