import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useSafeUserData } from './SafeUserDataProvider';

// SessionWarmer: low-priority background task that activates any stored passkey
// quickly but defers heavy cache-warming (readCategory) until after interactions
// to avoid throttling the splash/animations.
export default function SessionWarmer() {
  const { userId, getPasskey, activateSessionPasskey, warmLatestJournalEntries, getUserProfile, saveCredentialsToSecureStore } = useSafeUserData();
  const { userProfile, setUserProfile, setIsLocalProfile } = useUser();

  useEffect(() => {
    if (!userId) return;

    let didCancel = false;
  const { testSupabaseConnection } = require('../lib/supabase');
  let storedPass: string | null = null;

    // Activate stored passkey quickly (cheap) so session operations can use it.
    (async () => {
      try {
        const stored = await (async () => { try { return await getPasskey(); } catch { return null; } })();
        if (didCancel) return;
        if (stored) {
          try { activateSessionPasskey(stored); } catch (e) { /* ignore */ }
          storedPass = stored;
        }
      } catch (e) {
        // ignore
      }
    })();

    // Defer heavy warming until after interactions/animations finish
    const handle = InteractionManager.runAfterInteractions(() => {
      // additional small delay to ensure splash animations finished
      const t = setTimeout(() => {
        if (didCancel) return;
        (async () => {
          try {
            // Best-effort warm latest 15 entries across journal chunks; do not block UI
            if (warmLatestJournalEntries) await warmLatestJournalEntries(15);
            // After warming, also attempt to verify and sync encrypted userinfo with server profile
            try {
                if (storedPass) {
                try {
                  const local = await getUserProfile(storedPass);
                  // If we have a local encrypted profile and the app doesn't yet have a
                  // runtime userProfile (or the server profile is missing), apply the
                  // local profile so the UI can operate offline without needing user input.
                  if (local && (!userProfile || typeof userProfile !== 'object' || !userProfile.firstName)) {
                    try {
                      const mappedLocal = {
                        firstName: local.firstName ?? local.first_name ?? '',
                        lastName: local.lastName ?? local.last_name ?? null,
                        username: local.username ?? null,
                        birthDate: local.birthDate ?? local.birth_date ?? null,
                        profileImage: local.profileImage ?? local.profile_image ?? null,
                        partnerId: null,
                        partnerName: null,
                        currentStreak: userProfile?.currentStreak ?? 0,
                        longestStreak: userProfile?.longestStreak ?? 0,
                        lastCheckinDate: userProfile?.lastCheckinDate ?? null,
                        lastCheckinAt: userProfile?.lastCheckinAt ?? null,
                        streakStartedDate: userProfile?.streakStartedDate ?? null,
                        applanguage: local.applanguage ?? local.language ?? null,
                        apptheme: local.apptheme ?? local.apptheme ?? null,
                        selectedModules: Array.isArray(local.selectedModules) ? local.selectedModules.map((v: any) => (typeof v === 'number' ? v : Number(v))).filter((n: number) => Number.isFinite(n)) : [],
                        onboardingCompleted: !!(local.onboardingCompleted ?? local.onboarding_completed),
                      };
                      try { setUserProfile(mappedLocal); if (typeof setIsLocalProfile === 'function') setIsLocalProfile(true); } catch (e) { /* ignore */ }
                    } catch (e) { /* ignore */ }
                  }
                  
                  
                  
                  
                
                  
                  
                  
                  
                  
                  // Continue with the previous server sync logic below
                
                  
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                  
                
                
                
                  
                
                
                
                  
                
                
                  
                
                
                
                  
                
                
                  
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                  
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                
                  const serverBasic = {
                    firstName: userProfile?.firstName ?? '',
                    lastName: userProfile?.lastName ?? null,
                    username: userProfile?.username ?? null,
                    birthDate: userProfile?.birthDate ?? null,
                    applanguage: userProfile?.applanguage ?? null,
                    apptheme: userProfile?.apptheme ?? null,
                    selectedModules: userProfile?.selectedModules ?? undefined,
                    onboardingCompleted: userProfile?.onboardingCompleted ?? undefined,
                  };
                  const localBasic = local ? {
                    firstName: local.firstName ?? '',
                    lastName: local.lastName ?? null,
                    username: local.username ?? null,
                    birthDate: local.birthDate ?? null,
                    applanguage: local.applanguage ?? null,
                    apptheme: local.apptheme ?? null,
                    selectedModules: local.selectedModules ?? undefined,
                    onboardingCompleted: local.onboardingCompleted ?? undefined,
                  } : null;

          const changed = !localBasic || JSON.stringify(serverBasic) !== JSON.stringify(localBasic);
          // If server profile is present and differs, saving serverBasic means we're using server data
          if (changed) {
                    try {
                      if (saveCredentialsToSecureStore) await saveCredentialsToSecureStore(serverBasic);
            try { if (typeof setIsLocalProfile === 'function') setIsLocalProfile(false); } catch (e) { /* ignore */ }
                    } catch (e) { /* ignore save errors */ }
                  }
                } catch (e) { /* ignore profile decrypt/compare errors */ }
              }
            } catch (e) { /* ignore sync errors */ }
          } catch (e) {
            /* ignore warming errors */
          }
        })();
      }, 1000); // 1s after interactions

      return () => clearTimeout(t);
    });

    return () => {
      didCancel = true;
      try { (handle as any)?.cancel && (handle as any).cancel(); } catch (e) {}
    };
  }, [userId, getPasskey, activateSessionPasskey, warmLatestJournalEntries, userProfile, setUserProfile]);

  return null;
}
