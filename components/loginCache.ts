/**
 * Lightweight in-memory cache for LoginScreen form state.
 * Intentionally avoids AsyncStorage — lives only in this process memory
 * so values persist across component unmount/mount during navigation
 * but are not persisted to disk.
 */
type Mode = 'login' | 'signup';

type PerMode = {
  localValues?: { [k: string]: any } | null;
  formData?: { [k: string]: any } | null;
};

type CacheShape = {
  login?: PerMode;
  signup?: PerMode;
};

let cache: CacheShape = {};

export function saveLoginCache(payload: PerMode, mode: Mode = 'login') {
  cache = {
    ...cache,
    [mode]: {
      localValues: payload.localValues ? { ...payload.localValues } : cache[mode as keyof CacheShape]?.localValues,
      formData: payload.formData ? { ...payload.formData } : cache[mode as keyof CacheShape]?.formData,
    }
  } as CacheShape;
}

export function getLoginCache(mode: Mode = 'login'): PerMode | undefined {
  return cache[mode];
}

export function clearLoginCache(mode?: Mode) {
  if (!mode) {
    cache = {};
  } else {
    const c = { ...cache };
    delete (c as any)[mode];
    cache = c;
  }
}

export default { saveLoginCache, getLoginCache, clearLoginCache };
