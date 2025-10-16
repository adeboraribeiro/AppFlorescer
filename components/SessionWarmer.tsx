import { useEffect } from 'react';
import { InteractionManager } from 'react-native';
import { useSafeUserData } from './SafeUserDataProvider';

// SessionWarmer: low-priority background task that activates any stored passkey
// quickly but defers heavy cache-warming (readCategory) until after interactions
// to avoid throttling the splash/animations.
export default function SessionWarmer() {
  const { userId, getPasskey, activateSessionPasskey, readCategory } = useSafeUserData();

  useEffect(() => {
    if (!userId) return;

    let didCancel = false;

    // Activate stored passkey quickly (cheap) so session operations can use it.
    (async () => {
      try {
        const stored = await (async () => { try { return await getPasskey(); } catch { return null; } })();
        if (didCancel) return;
        if (stored) {
          try { activateSessionPasskey(stored); } catch (e) { /* ignore */ }
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
            // Best-effort warm; do not await or block UI
            await readCategory('journal');
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
  }, [userId, getPasskey, activateSessionPasskey, readCategory]);

  return null;
}
