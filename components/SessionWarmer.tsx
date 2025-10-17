import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useUser } from '../contexts/UserContext';
import { useSafeUserData } from './SafeUserDataProvider';

// SessionWarmer: low-priority background task that activates any stored passkey
// quickly but defers heavy cache-warming (readCategory) until after interactions
// to avoid throttling the splash/animations.
export default function SessionWarmer() {
  const { userId, getPasskey, activateSessionPasskey, warmLatestJournalEntries, getUserProfile, saveUserProfile } = useSafeUserData();
  const { userProfile } = useUser();

  useEffect(() => {
    if (!userId) return;

    let didCancel = false;
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
              if (storedPass && userProfile && typeof userProfile === 'object') {
                try {
                  const local = await getUserProfile(storedPass);
                  const serverBasic = {
                    firstName: userProfile.firstName ?? '',
                    lastName: userProfile.lastName ?? null,
                    username: userProfile.username ?? null,
                    birthDate: userProfile.birthDate ?? null,
                    applanguage: userProfile.applanguage ?? null,
                    apptheme: userProfile.apptheme ?? null,
                    selectedModules: userProfile.selectedModules ?? undefined,
                    onboardingCompleted: userProfile.onboardingCompleted ?? undefined,
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
                  if (changed) {
                    try {
                      await saveUserProfile(serverBasic, storedPass);
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
  }, [userId, getPasskey, activateSessionPasskey, warmLatestJournalEntries]);

  return null;
}
