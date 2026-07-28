export function insertTextAtSelection(value, insertText, selection = null) {
  const currentValue = String(value ?? '');
  const safeInsertText = String(insertText ?? '');
  const fallbackPosition = currentValue.length;
  const selectionStart = Math.max(
    0,
    Math.min(selection?.start ?? fallbackPosition, currentValue.length),
  );
  const selectionEnd = Math.max(
    selectionStart,
    Math.min(selection?.end ?? selectionStart, currentValue.length),
  );
  const nextValue = `${currentValue.slice(0, selectionStart)}${safeInsertText}${currentValue.slice(selectionEnd)}`;
  const nextCursor = selectionStart + safeInsertText.length;

  return {
    nextSelection: { start: nextCursor, end: nextCursor },
    nextValue,
  };
}

export function deleteTextAtSelection(value, selection = null) {
  const currentValue = String(value ?? '');
  if (currentValue.length === 0) {
    return {
      nextSelection: { start: 0, end: 0 },
      nextValue: currentValue,
    };
  }

  const fallbackPosition = currentValue.length;
  const selectionStart = Math.max(
    0,
    Math.min(selection?.start ?? fallbackPosition, currentValue.length),
  );
  const selectionEnd = Math.max(
    selectionStart,
    Math.min(selection?.end ?? selectionStart, currentValue.length),
  );
  const deleteStart = selectionStart === selectionEnd
    ? Math.max(selectionStart - 1, 0)
    : selectionStart;
  const nextValue = `${currentValue.slice(0, deleteStart)}${currentValue.slice(selectionEnd)}`;

  return {
    nextSelection: { start: deleteStart, end: deleteStart },
    nextValue,
  };
}
