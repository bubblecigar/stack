let stack = [];
const listeners = new Set();

function emitChange() {
  listeners.forEach((listener) => listener());
}

export function subscribe(listener) {
  listeners.add(listener);

  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot() {
  return stack;
}

export function push(value) {
  const nextValue = value.trim();
  const nextIndex = stack.length;

  stack = [...stack, nextValue];
  emitChange();

  return nextIndex;
}

export function updateAt(index, value) {
  const nextValue = value.trim();

  if (index < 0 || index >= stack.length) {
    return;
  }

  stack = stack.map((item, itemIndex) => (
    itemIndex === index ? nextValue : item
  ));
  emitChange();
}

export function removeAt(index) {
  if (index < 0 || index >= stack.length) {
    return;
  }

  stack = stack.filter((_, itemIndex) => itemIndex !== index);
  emitChange();
}
