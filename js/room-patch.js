// Paths are arrays, so player IDs and object keys need no escaping.
export function roomPatch(before, after, path = [], changes = []) {
  if (Object.is(before, after)) return changes;
  const objects = before && after && typeof before === 'object' && typeof after === 'object';
  if (objects && Array.isArray(before) === Array.isArray(after) && (!Array.isArray(before) || before.length === after.length)) {
    for (const key of Object.keys(before)) if (!Object.hasOwn(after, key)) changes.push({ path: [...path, key], remove: true });
    for (const key of Object.keys(after)) roomPatch(before[key], after[key], [...path, key], changes);
  } else changes.push({ path, value: after });
  return changes;
}

export function applyRoomPatch(room, changes) {
  let result = structuredClone(room);
  for (const change of changes) {
    if (change.path.some(key => ['__proto__', 'prototype', 'constructor'].includes(key))) throw new Error('Invalid room patch');
    if (!change.path.length) { result = structuredClone(change.value); continue; }
    const parent = change.path.slice(0, -1).reduce((value, key) => value[key], result);
    const key = change.path.at(-1);
    if (change.remove) delete parent[key]; else parent[key] = structuredClone(change.value);
  }
  return result;
}
