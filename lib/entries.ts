import * as FileSystem from 'expo-file-system';

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

// Fallback global path (backwards compatibility)
const GLOBAL_STORAGE_KEY = `${FileSystem.documentDirectory}flo/flo-legacy.json`;

async function fileGet(path: string): Promise<string | null> {
  try {
    const info = await FileSystem.getInfoAsync(path);
    if (!info.exists) return null;
    return await FileSystem.readAsStringAsync(path, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (e) {
    console.warn('FileSystem.readAsStringAsync failed', e);
    return null;
  }
}

async function fileSet(path: string, value: string): Promise<void> {
  try {
    const dir = path.replace(/\\/g, '/').split('/').slice(0, -1).join('/');
    try { await FileSystem.makeDirectoryAsync(dir, { intermediates: true }); } catch (e) { /* ignore */ }
    await FileSystem.writeAsStringAsync(path, value, { encoding: FileSystem.EncodingType.UTF8 });
  } catch (e) {
    console.warn('FileSystem.writeAsStringAsync failed', e);
  }
}

type JournalMap = { [id: string]: Entry };

type FloData = {
  user: string;
  journal?: JournalMap;
  // future categories can be added here (e.g. settings, drafts...)
};

export class EntryStore {
  private userId?: string;
  private data?: FloData;

  constructor() {
    this.userId = undefined;
    this.data = undefined;
  }

  // Set the current user id. All subsequent reads/writes target `user:<id>.flo` in AsyncStorage.
  setUser(userId: string) {
    if (!userId) throw new Error('userId is required');
    if (this.userId !== userId) {
      this.userId = userId;
      this.data = undefined; // force reload on next access
    }
  }

  clearUser() {
    this.userId = undefined;
    this.data = undefined;
  }

  private storageKey(): string {
    if (this.userId) return `${FileSystem.documentDirectory}flo/user-${this.userId}.flo`;
    return GLOBAL_STORAGE_KEY;
  }

  private async init() {
    if (this.data) return;
    try {
      const raw = await fileGet(this.storageKey());
      if (raw) {
        const parsed = JSON.parse(raw as string);
        if (parsed && typeof parsed === 'object' && parsed.user) {
          this.data = parsed as FloData;
        } else if (Array.isArray(parsed)) {
          const journal: JournalMap = {};
          (parsed as Entry[]).forEach(e => (journal[e.id] = e));
          this.data = { user: this.userId ?? 'unknown', journal };
        } else {
          this.data = { user: this.userId ?? 'unknown', journal: {} };
        }
      } else {
        this.data = { user: this.userId ?? 'unknown', journal: {} };
      }
    } catch (e) {
      console.warn('Failed to load user .flo data:', e);
      this.data = { user: this.userId ?? 'unknown', journal: {} };
    }
  }

  private async persist() {
    try {
      if (!this.data) return;
      await fileSet(this.storageKey(), JSON.stringify(this.data));
    } catch (e) {
      console.warn('Failed to save user .flo data:', e);
    }
  }

  // Journal-specific helpers
  private async ensureJournal() {
    await this.init();
    if (!this.data) {
      this.data = { user: this.userId ?? 'unknown', journal: {} };
    }
    if (!this.data.journal) this.data.journal = {};
  }

  async createEntry(input: CreateEntryInput): Promise<Entry> {
    await this.ensureJournal();
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

    this.data!.journal![id] = entry;
    await this.persist();
    return entry;
  }

  async getEntry(id: string): Promise<Entry | undefined> {
    await this.init();
    return this.data?.journal ? this.data.journal[id] : undefined;
  }

  async updateEntry(id: string, patch: UpdateEntryInput): Promise<Entry | undefined> {
    await this.ensureJournal();
    const existing = this.data!.journal![id];
    if (!existing) return undefined;

    const updated: Entry = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString()
    };

    this.data!.journal![id] = updated;
    await this.persist();
    return updated;
  }

  async listEntries(): Promise<Entry[]> {
    await this.init();
    const journal = this.data?.journal ?? {};
    return Object.values(journal).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  async deleteEntry(id: string): Promise<boolean> {
    await this.ensureJournal();
    if (!this.data!.journal![id]) return false;
    delete this.data!.journal![id];
    await this.persist();
    return true;
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
