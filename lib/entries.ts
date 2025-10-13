export type Entry = {
  id: string;
  title: string;
  body?: string;
  date: string; // ISO
};

const store = new Map<string, Entry>();

export function createEntry(e: Omit<Entry, 'id'> & { id?: string }): Entry {
  const id = e.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
  const entry: Entry = { id, title: e.title, body: e.body, date: e.date };
  store.set(id, entry);
  return entry;
}

export function getEntry(id: string): Entry | undefined {
  return store.get(id);
}

export function updateEntry(id: string, patch: Partial<Omit<Entry, 'id'>>): Entry | undefined {
  const existing = store.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  store.set(id, updated);
  return updated;
}

export function listEntries(): Entry[] {
  return Array.from(store.values());
}

export default { createEntry, getEntry, updateEntry, listEntries };
