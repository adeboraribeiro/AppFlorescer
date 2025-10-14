import AsyncStorage from '@react-native-async-storage/async-storage';

export type Entry = {
  id: string;
  title: string;
  body?: string;
  date: string; // ISO
  updatedAt?: string; // ISO
  createdAt: string; // ISO
};

export type CreateEntryInput = Omit<Entry, 'id' | 'createdAt' | 'updatedAt'> & { 
  id?: string;
};

export type UpdateEntryInput = Partial<Omit<Entry, 'id' | 'createdAt'>>;

const STORAGE_KEY = '@florescer_entries';

export class EntryStore {
  private store: Map<string, Entry>;
  private initialized: boolean;

  constructor() {
    this.store = new Map();
    this.initialized = false;
  }

  private async init() {
    if (this.initialized) return;
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) {
        const entries = JSON.parse(stored) as Entry[];
        entries.forEach(e => this.store.set(e.id, e));
      }
    } catch (e) {
      console.warn('Failed to load entries:', e);
    }
    this.initialized = true;
  }

  private async persist() {
    try {
      const entries = Array.from(this.store.values());
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch (e) {
      console.warn('Failed to save entries:', e);
    }
  }

  async createEntry(input: CreateEntryInput): Promise<Entry> {
    await this.init();
    const now = new Date().toISOString();
    const id = input.id ?? `${Date.now()}-${Math.random().toString(36).slice(2,9)}`;
    
    const entry: Entry = {
      id,
      title: input.title,
      body: input.body || '',
      date: input.date,
      createdAt: now,
      updatedAt: now
    };

    this.store.set(id, entry);
    await this.persist();
    return entry;
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    await this.init();
    return this.store.get(id);
  }

  async updateEntry(id: string, patch: UpdateEntryInput): Promise<Entry | undefined> {
    await this.init();
    const existing = this.store.get(id);
    if (!existing) return undefined;

    const updated: Entry = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.store.set(id, updated);
    await this.persist();
    return updated;
  }

  async listEntries(): Promise<Entry[]> {
    await this.init();
    return Array.from(this.store.values())
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async deleteEntry(id: string): Promise<boolean> {
    await this.init();
    const deleted = this.store.delete(id);
    if (deleted) {
      await this.persist();
    }
    return deleted;
  }

  // Helper methods for managing entry dates
  static formatDisplayDate(isoString: string): string {
    const date = new Date(isoString);
    return `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`;
  }

  static parseDisplayDate(displayDate: string): string {
    const [day, month, year] = displayDate.split('/').map(Number);
    return new Date(year, month - 1, day).toISOString();
  }
}

const entryStore = new EntryStore();
export default entryStore;
