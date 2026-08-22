export function constrainAddRelation(
  relation,
  childInsertionOnly = false,
  parentInsertionBlocked = false,
) {
  if (parentInsertionBlocked && relation === 'parent') {
    return null;
  }

  if (parentInsertionBlocked && relation === 'nextSibling') {
    return 'child';
  }

  if (!childInsertionOnly) {
    return relation;
  }

  if (relation === 'child' || relation === 'nextSibling') {
    return 'child';
  }

  return null;
}
