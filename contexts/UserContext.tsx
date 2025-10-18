import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
// NetworkHealth removed: rely on device-level NetInfo and explicit server checks
import { useSafeUserData } from '../components/SafeUserDataProvider';
import { supabase } from '../lib/supabase';
import { useTheme } from './ThemeContext';

type UserProfile = {
  firstName: string;
  lastName: string | null;
  username: string | null;
  birthDate: string | null;
  profileImage: string | null;
  partnerId: string | null;
  partnerName: string | null;
  currentStreak?: number;
  longestStreak?: number;
  lastCheckinDate?: string | null;
  lastCheckinAt?: string | null;
  streakStartedDate?: string | null;
  applanguage?: string | null;
  apptheme?: string | null;
  // persisted numeric module ids from the DB (profiles.selectedmodules)
  selectedModules?: number[];
  onboardingCompleted?: boolean;
};

type UserContextType = {
  userProfile: UserProfile | null;
  setUserProfile: (profile: UserProfile | null) => void;
  // true when the runtime profile was populated from local SecureStore fallback
  isLocalProfile: boolean;
  setIsLocalProfile: (v: boolean) => void;
  fetchUserProfile: () => Promise<void>;
  fetchStreak: () => Promise<void>;
  triggerStreak: () => Promise<void>;
  loading: boolean;
  needsOnboarding: boolean;
  setNeedsOnboarding: (v: boolean) => void;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isLocalProfile, setIsLocalProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(true);
  const { i18n } = useTranslation();
  const { theme, setTheme } = useTheme();

  const { getCredentialsFromSecureStore, getUserProfile } = useSafeUserData();

  // Determine whether a local profile object is sufficiently complete to be
  // considered a usable 'local profile'. We require a non-empty firstName as
  // the primary mandatory field. Also require an explicit theme and a birthDate
  // to avoid treating partially-initialized or malformed local blobs as valid.
  // Assumption: lastName is optional. If these requirements are too strict we
  // can relax them later, but being conservative prevents false-positive local
  // sessions when stored creds were wiped.
  function isValidLocalProfile(p: any | null | undefined): boolean {
    if (!p) return false;
    const first = (p.firstName ?? p.first_name ?? '').toString().trim();
    if (!first) return false;
    const birth = (p.birthDate ?? p.birth_date ?? null);
    if (!birth) return false;
    const themeVal = (p.apptheme ?? p.apptheme ?? p.theme ?? null);
    if (!themeVal) return false;
    // allow either 'light' or 'dark' or other truthy values
    return true;
  }

  const fetchUserProfile = useCallback(async (): Promise<void> => {
  try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Fetch only the minimal, known-good columns from profiles.
        // The database was recently cleaned and many legacy columns may be missing;
        // requesting unknown columns causes PostgREST schema errors. Select only
        // columns we know exist so the client remains robust.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, username, birth_date, profile_image, applanguage, apptheme, selectedmodules, onboarding_completed, id, updated_at')
          .eq('id', user.id)
          .single();

        // If server profile missing or errored, try offline encrypted profile
        // Prefer credentials stored in SecureStore (never fall back to writing/reading
        // credentials from the .flo file). If the server profile is missing, try
        // reading credentials from SecureStore.
        let resolvedProfile: any = profile ?? null;
        if (profileError || !resolvedProfile) {
          try {
            const creds = getCredentialsFromSecureStore ? await (async () => { try { return await getCredentialsFromSecureStore(); } catch { return null; } })() : null;
            if (creds) {
              resolvedProfile = {
                first_name: creds.firstName ?? creds.first_name ?? '',
                last_name: creds.lastName ?? creds.last_name ?? null,
                username: creds.username ?? null,
                birth_date: creds.birthDate ?? creds.birth_date ?? null,
                profile_image: creds.profileImage ?? creds.profile_image ?? null,
                applanguage: creds.applanguage ?? creds.language ?? null,
                apptheme: creds.apptheme ?? creds.apptheme ?? null,
                selectedmodules: creds.selectedModules ?? creds.selectedmodules ?? null,
                onboarding_completed: creds.onboardingCompleted ?? creds.onboarding_completed ?? false,
                id: user.id,
              };
            }
          } catch (e) {
            console.warn('Offline fallback getCredentialsFromSecureStore failed:', e);
          }
        }

        // Normalize persisted selected module ids to number[] for runtime use
        const rawSelected = resolvedProfile?.selectedmodules ?? resolvedProfile?.selectedModules;
        const selectedModules: number[] = Array.isArray(rawSelected)
          ? rawSelected
              .map((v: any) => (typeof v === 'number' ? v : Number(v)))
              .filter((n: number) => Number.isFinite(n))
          : [];

  // SIMPLE ONBOARDING CHECK - NO PLAN EXPORTER LOGIC HERE
  const onboardingCompletedFlag = !!resolvedProfile?.onboarding_completed;
        const hasServerFeatures = selectedModules.length > 0;

        // Set needs onboarding based ONLY on server state
        const needs = !(hasServerFeatures || onboardingCompletedFlag);
        setNeedsOnboarding(needs);

        // Build a conservative user profile from the remaining known columns.
        // Attempt to load the user's streak row (kept private to authenticated users)
        let streakRow: any = null;
        try {
          const { data: s } = await supabase
            .from('streaks')
            .select('current_streak, previous_maxstreak, last_triggered_date, isstreakactive, streaknumber, started_at')
            .eq('id', user.id)
            .single();
          streakRow = s;
        } catch (e) {
          // Non-fatal: if the table or row doesn't exist yet, continue with defaults
          console.warn('Failed to read streaks row for user:', e);
        }

  const userData: UserProfile = {
          firstName: resolvedProfile?.first_name || '',
          lastName: resolvedProfile?.last_name || null,
          username: resolvedProfile?.username ?? null,
          birthDate: resolvedProfile?.birth_date ?? null,
          profileImage: resolvedProfile?.profile_image ?? null,
          partnerId: null,
          partnerName: null,
          currentStreak: typeof streakRow?.current_streak === 'number' ? streakRow.current_streak : 0,
          longestStreak: typeof streakRow?.previous_maxstreak === 'number' ? streakRow.previous_maxstreak : 0,
          lastCheckinDate: streakRow?.last_triggered_date ?? null,
          lastCheckinAt: null,
          streakStartedDate: streakRow?.started_at ? String(streakRow.started_at) : null,
          applanguage: resolvedProfile?.applanguage ?? null,
          apptheme: resolvedProfile?.apptheme ?? null,
          selectedModules,
          onboardingCompleted: !!resolvedProfile?.onboarding_completed,
        };
  setUserProfile(userData);
  // Server profile loaded successfully -> not a local-only profile
  try { setIsLocalProfile(false); } catch (e) { /* ignore */ }

        // Apply persisted preferences if available
        try {
          if (userData.applanguage && userData.applanguage !== i18n.language) {
            void i18n.changeLanguage(userData.applanguage);
          }
        } catch (e) {
          console.warn('Failed to apply persisted language from profile:', e);
        }

        try {
          // Apply persisted explicit theme immediately instead of toggling
          if (userData.apptheme && userData.apptheme !== theme && typeof setTheme === 'function') {
            const desired = (userData.apptheme === 'light' ? 'light' : 'dark');
            setTheme(desired);
          }
        } catch (e) {
          console.warn('Failed to apply persisted theme from profile:', e);
        }
      } else {
        setNeedsOnboarding(true);
      }
    } catch (error) {
      console.error('Error fetching user profile:', error);
      // If any network call fails (auth/profile/streaks), try best-effort to load
      // the locally persisted encrypted userinfo so the app remains usable offline.
      try {
        const local = getCredentialsFromSecureStore ? await getCredentialsFromSecureStore() : await getUserProfile();
  if (local) {
          const mappedLocal: UserProfile = {
            firstName: local.firstName ?? local.first_name ?? '',
            lastName: local.lastName ?? local.last_name ?? null,
            username: local.username ?? null,
            birthDate: local.birthDate ?? local.birth_date ?? null,
            profileImage: local.profileImage ?? local.profile_image ?? null,
            partnerId: null,
            partnerName: null,
            currentStreak: 0,
            longestStreak: 0,
            lastCheckinDate: null,
            lastCheckinAt: null,
            streakStartedDate: null,
            applanguage: local.applanguage ?? local.language ?? null,
            apptheme: local.apptheme ?? local.apptheme ?? null,
            selectedModules: Array.isArray(local.selectedModules) ? local.selectedModules.map((v: any) => (typeof v === 'number' ? v : Number(v))).filter((n: number) => Number.isFinite(n)) : [],
            onboardingCompleted: !!(local.onboardingCompleted ?? local.onboarding_completed),
          };
          setUserProfile(mappedLocal);
          // We loaded a local fallback due to network failure -> mark as local
          // only if the mapped profile meets our minimal validity checks.
          try {
            setIsLocalProfile(isValidLocalProfile(mappedLocal));
          } catch (e) { /* ignore */ }
          // Apply language/theme from local profile if present
          try { if (mappedLocal.applanguage && mappedLocal.applanguage !== i18n.language) { void i18n.changeLanguage(mappedLocal.applanguage); } } catch (e) { /* ignore */ }
          try { if (mappedLocal.apptheme && mappedLocal.apptheme !== theme && typeof setTheme === 'function') { const desired = (mappedLocal.apptheme === 'light' ? 'light' : 'dark'); setTheme(desired); } } catch (e) { /* ignore */ }
        }
      } catch (e) {
        console.warn('Offline fallback (catch) getUserProfile failed:', e);
      }
    } finally {
      setLoading(false);
    }
  }, [i18n, theme, setTheme]);

  const fetchStreak = useCallback(async (): Promise<void> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: s, error } = await supabase
        .from('streaks')
        .select('current_streak, previous_maxstreak, last_triggered_date, isstreakactive, streaknumber, started_at')
        .eq('id', user.id)
        .single();
      if (error) {
        console.warn('fetchStreak error', error);
        return;
      }
      // merge into existing profile state if present
      setUserProfile(prev => {
        if (!prev) return prev;
        return {
          ...prev,
          currentStreak: typeof s?.current_streak === 'number' ? s.current_streak : prev.currentStreak,
          longestStreak: typeof s?.previous_maxstreak === 'number' ? s.previous_maxstreak : prev.longestStreak,
          lastCheckinDate: s?.last_triggered_date ?? prev.lastCheckinDate,
          streakStartedDate: s?.started_at ? String(s.started_at) : prev.streakStartedDate,
        };
      });
    } catch (e) {
      console.warn('Error fetching streak row:', e);
    }
  }, []);

  const triggerStreak = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        // no-op when unauthenticated
        console.warn('triggerStreak called with no authenticated user');
        return;
      }
      // Call the server-side RPC that encapsulates the timezone logic and safety checks.
      const { data, error } = await supabase.rpc('trigger_streak', { user_id: user.id });
      if (error) {
        console.warn('trigger_streak rpc error:', error);
      } else {
        // Refresh local profile and streaks after a successful trigger
+        await fetchUserProfile();
      }
    } catch (e) {
      console.warn('triggerStreak failed:', e);
    } finally {
      setLoading(false);
    }
  }, [fetchUserProfile]);

  useEffect(() => {
  // Trigger an initial profile fetch. If it fails, fetchUserProfile will
  // try local fallbacks and mark the runtime as local when appropriate.
  void fetchUserProfile();
  return () => {};
  }, []);

  return (
    <UserContext.Provider value={{ userProfile, setUserProfile, isLocalProfile, setIsLocalProfile, fetchUserProfile, fetchStreak, triggerStreak, loading, needsOnboarding, setNeedsOnboarding }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  const context = useContext(UserContext);
  if (context === undefined) {
    // Defensive fallback: avoid crashing in environments where the provider
    // wasn't mounted yet (fast refresh, partial mount). Log to aid debugging
    // but return a safe, no-op shaped object so consumers can continue.
    // This prevents the runtime "must be used within a UserProvider" error while
    // we ensure providers are mounted at the app root.
    // eslint-disable-next-line no-console
    console.warn('useUser called outside UserProvider - returning fallback stub');
    const noopAsync = async () => {};
    return {
      userProfile: null,
      setUserProfile: () => {},
  isLocalProfile: false,
  setIsLocalProfile: () => {},
      fetchUserProfile: noopAsync,
      fetchStreak: noopAsync,
      triggerStreak: noopAsync,
      loading: false,
      needsOnboarding: true,
      setNeedsOnboarding: () => {},
    } as UserContextType;
  }
  return context;
}

// Hook for onboarding screens ONLY
export function useOnboardingLoader() {
  // Intentionally no-op: onboarding loader previously dynamically imported the planexport
  // module. To prevent bundling the planexport module at runtime, callers should not
  // rely on this loader. Keep a stub to preserve API surface for onboarding screens.
  const loadPlanExporter = useCallback(async () => {
    // Return null; callers must handle missing loader. Use `any` to avoid
    // referencing the planexport module type which would reintroduce bundling.
    return null as any;
  }, []);

  return { loadPlanExporter };
}