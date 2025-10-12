import AsyncStorage from '@react-native-async-storage/async-storage';
import en from '../i18n/en';
import es from '../i18n/es';
import ptBR from '../i18n/pt-BR';
import { supabase } from '../lib/supabase';

type PlanItem = {
  // stable translation key (preferred) and the localized title string
  key?: string;
  title: string;
};

export const SELECTED_PLANS_KEY = '@florescer:selected_plans';

/**
 * Build an array of plan items using the provided translator `t` and the selection state.
 * Writes the resulting JSON to AsyncStorage under SELECTED_PLANS_KEY.
 */
export async function exportSelectedPlans(options: { primary: 'wellness' | 'productivity' | null; wellnessPath: 'general' | 'challenges' | null; amandaSelected: boolean; }, t: (key: string) => string) {
  const { primary, wellnessPath, amandaSelected } = options;
  const items: PlanItem[] = [];

  // Export only the TITLE strings from the onboarding screens (not descriptions).
  // Combinations:
  // - wellness + general
  // - wellness + challenges
  // - productivity (secondary)
  if (primary === 'wellness') {
    items.push({ key: 'onboarding.option_wellness_title', title: t('onboarding.option_wellness_title') });
    if (wellnessPath === 'general') {
      items.push({ key: 'onboarding.option_general_title', title: t('onboarding.option_general_title') });
    } else if (wellnessPath === 'challenges') {
      items.push({ key: 'onboarding.option_challenges_title', title: t('onboarding.option_challenges_title') });
    }
  } else if (primary === 'productivity' || amandaSelected) {
    // Export both the main productivity title and the secondary productivity title
    // so the UI can render primary as the bold title and secondary as the smaller subtitle.
    items.push({ key: 'onboarding.option_productivity_title', title: t('onboarding.option_productivity_title') });
    items.push({ key: 'onboarding.option_productivity_secondary_title', title: t('onboarding.option_productivity_secondary_title') });
  }

  try {
  // Overwrite previous value directly. Avoid removeItem step to reduce async churn
  await AsyncStorage.setItem(SELECTED_PLANS_KEY, JSON.stringify(items));
    return items;
  } catch (e) {
    console.error('Failed to export selected plans:', e);
    throw e;
  }
}

export async function readSelectedPlans(): Promise<PlanItem[] | null> {
  try {
    const json = await AsyncStorage.getItem(SELECTED_PLANS_KEY);
    if (!json) return null;
    const parsed = JSON.parse(json) as PlanItem[];
    // Deduplicate titles just in case
    const seen = new Set<string>();
    const deduped: PlanItem[] = [];
    for (const it of parsed) {
      if (!seen.has(it.title)) {
        deduped.push(it);
        seen.add(it.title);
      }
    }
    // Backfill stable translation keys for legacy exports that only stored
    // localized title strings. We compare against known onboarding title
    // keys across supported locales and, when a match is found, attach the
    // `key` property so runtime rendering can call `t(key)` instead of
    // displaying a frozen localized string.
    const LOCALES: Record<string, any> = { en, es, 'pt-BR': ptBR };
    const CANDIDATE_KEYS = [
      'onboarding.option_wellness_title',
      'onboarding.option_general_title',
      'onboarding.option_challenges_title',
      'onboarding.option_productivity_title',
      'onboarding.option_productivity_secondary_title'
    ];

    let changed = false;
    for (const item of deduped) {
      if ((item as any).key) continue; // already has key
      const raw = (item.title || '').toString().trim();
      if (!raw) continue;
      for (const locale of Object.keys(LOCALES)) {
        const res = LOCALES[locale];
        for (const k of CANDIDATE_KEYS) {
          // navigate nested path (e.g. onboarding.option_wellness_title)
          const parts = k.split('.');
          let v: any = res;
          for (const p of parts) {
            if (!v) break;
            v = v[p];
          }
          if (v && String(v).trim() === raw) {
            (item as any).key = k;
            changed = true;
            break;
          }
        }
        if ((item as any).key) break;
      }
    }

    if (changed) {
      try {
        await AsyncStorage.setItem(SELECTED_PLANS_KEY, JSON.stringify(deduped));
      } catch (e) {
        console.warn('[planExporter] failed to persist backfilled plan keys', e);
      }
    }

    return deduped;
  } catch (e) {
    console.error('Failed to read selected plans:', e);
    return null;
  }
}

export async function clearSelectedPlans() {
  try {
    await AsyncStorage.removeItem(SELECTED_PLANS_KEY);
  } catch (e) {
    console.error('Failed to clear selected plans:', e);
    throw e;
  }
}

/**
 * Read exported plans from AsyncStorage and return the numeric selectedmodules array
 * suitable for writing to the DB (integer[] like [1,2,3]).
 * This is a pure helper: it does not modify storage, DB, or onboarding flags.
 */
export async function getSelectedFeatureIds(): Promise<number[] | null> {
  try {
    const plans = await readSelectedPlans();
    if (!plans || plans.length === 0) return null;

    const texts = plans.map((p: PlanItem) => {
      if (p && typeof p === 'object') {
        return ((p.key && String(p.key)) || (p.title && String(p.title)) || '').toLowerCase();
      }
      return String(p).toLowerCase();
    });
    // Map exported plan texts (keys or localized titles) to the exact numeric
    // `selectedmodules` arrays defined by product requirements.
    const PRODUCTIVITY_MODULES = [6, 7, 8, 3]; // FocusMode, Planner, TaskManager, Pomodoro
    const WELLNESS_GENERAL_MODULES = [9, 4, 12, 10]; // Habits, Journal, MoodTracker, MinimalApps
  const WELLNESS_RECOVERY_MODULES = [1, 4, 5, 12]; // Partnership, Journal, Recovery, MoodTracker

    const hasProductivity = texts.some(t => /productivity|pomodoro|focus|productividad/.test(t));
    if (hasProductivity) return PRODUCTIVITY_MODULES.slice();

    const hasWellness = texts.some(t => /wellness|bienestar/.test(t));
    if (hasWellness) {
      const isGeneral = texts.some(t => /general/.test(t) || /generalwellbeing/.test(t) || /option_general/.test(t));
      const isChallenges = texts.some(t => /recovery|challenges|recuper|desaf|challenge|option_challenges/.test(t));
      if (isGeneral) return WELLNESS_GENERAL_MODULES.slice();
      if (isChallenges) return WELLNESS_RECOVERY_MODULES.slice();
      // default to general wellness if ambiguous
      return WELLNESS_GENERAL_MODULES.slice();
    }

    // Fallback: return a minimal set (Journal + Bromelia mapped to their numeric ids)
    return [4, 2];
  } catch (e) {
    console.warn('[planExporter] getSelectedFeatureIds failed', e);
    return null;
  }
}

/**
 * After auth/profile load, check if onboarding should be applied.
 * - reads the exported plan titles stored under SELECTED_PLANS_KEY
 * - maps them to the runtime AVAILABLE_MODULES ids
 * - writes enabled modules to AsyncStorage (MODULES_KEY equivalent)
 * - persists selectedmodules and onboarding_completed to the user's profile in Supabase
 */
export async function applyOnboardingModulesIfNeeded(passedUserId?: string) {
  try {
    // read exported plan titles
    const json = await AsyncStorage.getItem(SELECTED_PLANS_KEY);
    if (!json) return; // nothing to apply
    const parsed = JSON.parse(json) as { title: string }[] | null;
    if (!parsed || parsed.length === 0) return;

    // Build keyword text from either the stable key (preferred) or the
    // localized title (for backward compatibility). Lowercase to simplify
    // substring checks across languages where keys still contain english
    // keywords (e.g. 'productivity').
    const texts = parsed.map((p: any) => {
      if (p && typeof p === 'object') {
        // prefer key if present
        const v = (p.key && p.key.toString()) || (p.title && p.title.toString()) || '';
        return v.toLowerCase();
      }
      const raw = p ? String(p) : '';
      return raw.toLowerCase();
    });

    // Keyword-based mapping from title/key text to module ids.
    // New mapping: produce the exact numeric arrays per selected plan texts.
    const PRODUCTIVITY_MODULES = [6, 7, 8, 3]; // FocusMode, Planner, TaskManager, Pomodoro
    const WELLNESS_GENERAL_MODULES = [9, 4, 12, 10]; // Habits, Journal, MoodTracker, MinimalApps
  const WELLNESS_RECOVERY_MODULES = [1, 4, 5, 12]; // Partnership, Journal, Recovery, MoodTracker

    const hasProductivity = texts.some(t => /productivity|pomodoro|focus|productividad/.test(t));
    let finalNumeric: number[] = [];
    if (hasProductivity) {
      finalNumeric = PRODUCTIVITY_MODULES.slice();
    } else if (texts.some(t => /wellness|bienestar/.test(t))) {
      const isGeneral = texts.some(t => /general/.test(t) || /generalwellbeing/.test(t) || /option_general/.test(t));
      const isChallenges = texts.some(t => /recovery|challenges|recuper|desaf|challenge|option_challenges/.test(t));
      if (isGeneral) finalNumeric = WELLNESS_GENERAL_MODULES.slice();
      else if (isChallenges) finalNumeric = WELLNESS_RECOVERY_MODULES.slice();
      else finalNumeric = WELLNESS_GENERAL_MODULES.slice();
    } else {
      // fallback
      finalNumeric = [4, 2];
    }
    // persist locally using the same key ManageModules uses (stored as an array of numbers)
    const MODULES_KEY = 'enabledModules';
    try {
      await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(finalNumeric));
    } catch (e) {
      console.warn('[planExporter] failed to write enabledModules to AsyncStorage', e);
    }

  // persist to Supabase profiles.selectedmodules (as integer array) and set onboarding_completed = true
    try {
      let uid: string | undefined = passedUserId;
      if (!uid) {
        const { data: { user } } = await supabase.auth.getUser();
        uid = user?.id;
      }

          if (uid) {
          	  const { error } = await supabase
            .from('profiles')
            .update({ selectedmodules: finalNumeric })
            .eq('id', uid);
          if (error) {
              console.warn('[planExporter] failed to persist onboarding modules to profile:', error);
              try {
                const key = '@florescer:plan_export_diag';
                const raw = await AsyncStorage.getItem(key);
                const arr = raw ? JSON.parse(raw) : [];
                arr.push({ time: new Date().toISOString(), uid, finalNumeric, error });
                await AsyncStorage.setItem(key, JSON.stringify(arr.slice(-50)));
              } catch (e) {
                // ignore diag write errors
              }
          }
        }
    } catch (e) {
      console.warn('[planExporter] error persisting onboarding modules:', e);
    }
  } catch (e) {
    console.warn('[planExporter] applyOnboardingModulesIfNeeded failed', e);
  }
}

export default null;
