export function constrainAddRelation(relation, childInsertionOnly = false) {
  if (!childInsertionOnly) {
    return relation;
  }

  if (relation === 'child' || relation === 'nextSibling') {
    return 'child';
  }

  return null;
}
