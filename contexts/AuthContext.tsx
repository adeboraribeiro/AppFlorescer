import AsyncStorage from '@react-native-async-storage/async-storage';
import { Session, User } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { createContext, useContext, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Linking } from 'react-native';
import { supabase } from '../lib/supabase';

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
}

interface AuthContextType extends AuthState {
  signUp: (email: string, password: string, metadata?: { [key: string]: any }) => Promise<{ user: User | null; session: Session | null }>
  signIn: (email: string, password: string) => Promise<User>
  signInWithProvider: (provider: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const LAST_SESSION_KEY = '@florescer:last_session_v1';
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    loading: true,
  })

  useEffect(() => {
    let mounted = true;

    // Check active session
    async function checkSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (mounted) {
          setState(prev => ({
            ...prev,
            session,
            user: session?.user ?? null,
            loading: false,
          }));
        }
        // persist last known session for offline fallback
        try {
          if (session) await AsyncStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session));
        } catch (e) { console.warn('[Auth] failed to persist session', e); }
      } catch (error) {
        console.error('Session check error:', error);
        if (mounted) {
          setState(prev => ({
            ...prev,
            loading: false,
          }));
        }
      }
    }

    checkSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        try {
          console.log('[Auth] onAuthStateChange', { event, userId: session?.user?.id ?? null, email: session?.user?.email ?? null });
        } catch (e) {}
        if (!mounted) return;

        // If session is present, update state and persist it
        if (session) {
          setState(prev => ({ ...prev, session, user: session.user ?? null, loading: false }));
          try { await AsyncStorage.setItem(LAST_SESSION_KEY, JSON.stringify(session)); } catch (e) { console.warn('[Auth] failed to persist session', e); }
          return;
        }

        // session is null: attempt to read last persisted session and use as offline fallback
        try {
          const raw = await AsyncStorage.getItem(LAST_SESSION_KEY);
          if (raw) {
            try {
              const parsed = JSON.parse(raw) as Session;
              // Validate that local credential material still exists for this user
              // before treating the persisted session as an offline fallback.
              const uid = parsed?.user?.id;
              let hasLocalCreds = false;
              if (uid) {
                try {
                  const credKey = `flo-creds-${uid}`;
                  const passKey = `flo-passkey-${uid}`;
                  const creds = await SecureStore.getItemAsync(credKey);
                  const pass = await SecureStore.getItemAsync(passKey);
                  if (creds || pass) hasLocalCreds = true;
                  else {
                    // also check AsyncStorage-cached pfp urls/paths
                    const pfpLocal = `@florescer:pfp_local_v1:${uid}`;
                    const pfpUrl = `@florescer:pfp_url_v1:${uid}`;
                    const pl = await AsyncStorage.getItem(pfpLocal);
                    const pu = await AsyncStorage.getItem(pfpUrl);
                    if (pl || pu) hasLocalCreds = true;
                  }
                } catch (e) {
                  // ignore SecureStore read failures and assume no creds
                  hasLocalCreds = false;
                }
              }

              if (hasLocalCreds) {
                // Use persisted session locally but keep loading=false to avoid routing away.
                setState(prev => ({ ...prev, session: parsed, user: parsed.user ?? null, loading: false }));
                return;
              }

              // No credential material found — clear persisted session to avoid treating
              // a stale server session as a live authenticated user when credentials were wiped.
              try { await AsyncStorage.removeItem(LAST_SESSION_KEY); } catch (e) { /* ignore */ }
            } catch (e) {
              // fall through to clear
            }
          }
        } catch (e) {
          console.warn('[Auth] failed to read last session fallback', e);
        }

        // No valid fallback available: clear state
        setState(prev => ({ ...prev, session: null, user: null, loading: false }));
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    }
  }, [])

  const value = {
    ...state,
    signUp: async (email: string, password: string, metadata?: { [key: string]: any }) => {
      try {
        if (!metadata) {
          throw new Error(t('auth.errors.profile_info_required'));
        }

        // Create metadata object with proper key names
        const userMetadata = {
          first_name: metadata.firstName || metadata.first_name || '',
          last_name: metadata.lastName || metadata.last_name || '',
          username: metadata.username || '',
          birth_date: metadata.birthDate || metadata.birth_date || ''
        };

        // Check for empty required fields
  if (!userMetadata.first_name) throw new Error(t('auth.errors.first_name_required'));
  if (!userMetadata.last_name) throw new Error(t('auth.errors.last_name_required'));
  if (!userMetadata.username) throw new Error(t('auth.errors.username_required'));
  if (!userMetadata.birth_date) throw new Error(t('auth.errors.birthdate_required'));

        // Check if username already exists
        const { data: existingUser, error: checkError } = await supabase
          .from('profiles')
          .select('username')
          .eq('username', userMetadata.username)
          .single();

        if (existingUser) {
          throw new Error(t('auth.errors.username_taken'));
        }

        // Build payload data for Supabase signUp. Accept both english and
        // persisted key names (language/theme) and prefer canonical profile
        // column names used elsewhere in the app (applanguage/apptheme).
        const signupData: any = {
          first_name: userMetadata.first_name,
          last_name: userMetadata.last_name,
        };

        // Helpers: applanguage must be <= 5 chars; apptheme must be 'dark' or 'light'
        const sanitizeLanguage = (v: any) => {
          try {
            const s = String(v ?? '').trim();
            return s.length > 5 ? s.slice(0, 5) : s;
          } catch {
            return '';
          }
        };
        const sanitizeTheme = (v: any) => {
          try {
            const s = String(v ?? '').toLowerCase();
            return s === 'dark' ? 'dark' : 'light';
          } catch {
            return 'light';
          }
        };

        // Attach username and birth_date if present (we validated them above)
        if (userMetadata.username) signupData.username = userMetadata.username;
        if (userMetadata.birth_date) signupData.birth_date = userMetadata.birth_date;

        // Allow callers to pass language/theme using either 'language'/'theme'
        // or 'applanguage'/'apptheme'. Normalize to applanguage/apptheme.
        if (metadata.applanguage || (metadata as any).language) {
          const rawLang = metadata.applanguage || (metadata as any).language;
          const lang = sanitizeLanguage(rawLang);
          if (lang) signupData.applanguage = lang;
        }
        if (metadata.apptheme || (metadata as any).theme) {
          const rawTheme = metadata.apptheme || (metadata as any).theme;
          signupData.apptheme = sanitizeTheme(rawTheme);
        }

        // If selectedmodules are provided via metadata, include them in the
        // signup payload so the server-side signup trigger can create the
        // profile with these modules during account creation (avoids anon
        // client-side profile INSERTs which may be blocked by RLS).
      if (Array.isArray((metadata as any).selectedmodules) && (metadata as any).selectedmodules.length > 0) {
          try {
            // prefer numeric values for selectedmodules
        const provided = (metadata as any).selectedmodules
              .map((v: any) => Number(v))
              .filter((n: any) => Number.isFinite(n));
        signupData.selectedmodules = provided;
        console.log('[signup][debug] selectedmodules provided via metadata:', provided);
          } catch (e) {
            // ignore malformed selectedmodules
          }
        } else {
          // If metadata did not include selectedmodules, try reading the
          // locally exported onboarding plans and translate them to numeric
          // module ids so they are included in the signup request.
          try {
            const raw = await AsyncStorage.getItem('@florescer:selected_plans');
            console.log('[signup][debug] raw exported plans from AsyncStorage:', raw);
            if (raw) {
              try {
                const parsed = JSON.parse(raw) as Array<any> | null;
                console.log('[signup][debug] parsed exported plans:', parsed);
                if (parsed && parsed.length > 0) {
                  const texts = parsed.map((p: any) => {
                    if (p && typeof p === 'object') {
                      return ((p.key && p.key.toString()) || (p.title && p.title.toString()) || '').toLowerCase();
                    }
                    return String(p).toLowerCase();
                  });
                  console.log('[signup][debug] derived texts from exported plans:', texts);

                  const enabled = new Set<string>();
                  for (const ttext of texts) {
                    if (ttext.includes('productivity') || ttext.includes('pomodoro') || ttext.includes('focus') || ttext.includes('productividad')) {
                      enabled.add('Pomodoro');
                      enabled.add('Journal');
                    }
                    if (ttext.includes('wellness') || ttext.includes('general wellness') || ttext.includes('bienestar')) {
                      enabled.add('Journal');
                      enabled.add('Bromelia');
                      enabled.add('Recovery');
                    }
                    if (ttext.includes('recovery') || ttext.includes('challenges') || ttext.includes('recuper') || ttext.includes('desaf')) {
                      enabled.add('Recovery');
                      enabled.add('Journal');
                    }
                  }
                  console.log('[signup][debug] module names enabled (pre-filter):', Array.from(enabled));

                  if (enabled.size === 0) {
                    enabled.add('Journal');
                    enabled.add('Bromelia');
                  }

                  const MODULE_ID_TO_NUM: Record<string, number> = {
                    Partnership: 1,
                    Bromelia: 2,
                    Pomodoro: 3,
                    Journal: 4,
                    Recovery: 5,
                  };

                  const finalModules = Array.from(enabled).filter(id => MODULE_ID_TO_NUM[id] !== undefined);
                  const finalNumeric = finalModules.map(id => MODULE_ID_TO_NUM[id]).filter((n): n is number => typeof n === 'number');
                  console.log('[signup][debug] final module names after filter:', finalModules);
            console.log('[signup][debug] final numeric selectedmodules:', finalNumeric);

            if (finalNumeric && finalNumeric.length > 0) signupData.selectedmodules = finalNumeric;
                }
              } catch (e) {
                console.warn('[signup][debug] malformed exported plans JSON', e);
              }
            }
          } catch (e) {
            console.warn('[signup][debug] failed reading exported plans from storage', e);
          }
        }

        // Sign up the user with the constructed metadata
        try {
          console.log('[signup][debug] signupData going to supabase.auth.signUp:', JSON.stringify(signupData));
        } catch (e) {
          console.log('[signup][debug] signupData (non-serializable) fallback log:', signupData);
        }

        // Ultra-detailed logging for selectedmodules to show every comma and
        // the exact string representation sent to the server.
        try {
          const sf = (signupData as any).selectedmodules;
          if (Array.isArray(sf)) {
            const jsonSf = JSON.stringify(sf);
            const joined = sf.join(',');
            console.log('[signup][debug] selectedmodules array:', sf);
            console.log('[signup][debug] selectedmodules JSON.stringify:', jsonSf);
            console.log('[signup][debug] selectedmodules joined with commas (raw):', '"' + joined + '"');

            // find comma positions in the JSON representation
            const commaPositions: number[] = [];
            for (let i = 0; i < jsonSf.length; i++) {
              if (jsonSf[i] === ',') commaPositions.push(i);
            }
            console.log('[signup][debug] comma positions in JSON string:', commaPositions);

            // small indexed-char dump to visually inspect commas (truncate to 1000 chars)
            const maxChars = 1000;
            const chars = jsonSf.split('').map((c, i) => `${i}:${c}`);
            console.log('[signup][debug] indexed JSON chars (truncated):', chars.slice(0, maxChars));
          } else {
            console.log('[signup][debug] selectedmodules not present on signupData');
          }
        } catch (e) {
          console.warn('[signup][debug] detailed selectedmodules logging failed', e);
        }

        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: 'exp://localhost:19000/--/auth/callback',
            data: signupData
          }
        });

        console.log('[signup][debug] supabase.auth.signUp response:', { data, error });

        if (error) throw error;

        // If signup successful but no user returned
        if (!data?.user) {
          throw new Error(t('auth.errors.signup_no_user'));
        }

  // Note: profile creation is handled by the auth signup trigger/server-side
  // using the `options.data` we provided above. We intentionally do NOT
  // perform a separate client-side INSERT here to avoid anon RLS issues.

        return data;
      } catch (error: any) {
        throw error;
      }
    },
    signIn: async (emailOrUsername: string, password: string) => {
      // Set loading state before starting
      setState(prev => ({ ...prev, loading: true }));
      
      try {
        let loginEmail = emailOrUsername;

        // Check if input is a username (doesn't contain @)
        if (!emailOrUsername.includes('@')) {
          // Try to find the email associated with this username. If the
          // profiles row does not have an email field populated, fall back to
          // querying auth.users by the profile id to retrieve the canonical
          // email before failing.
          const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('email, id')
            .eq('username', emailOrUsername)
            .maybeSingle();
          // Record diagnostics for this lookup so developers can inspect failures
          const diagKey = '@florescer:login_diag';
          const pushDiag = async (entry: any) => {
            try {
              const now = new Date().toISOString();
              const raw = await AsyncStorage.getItem(diagKey);
              const arr = raw ? JSON.parse(raw) : [];
              arr.push({ time: now, ...entry });
              await AsyncStorage.setItem(diagKey, JSON.stringify(arr.slice(-25))); // keep last 25
            } catch (e) {
              // ignore diag failures
            }
          };

          if (profileError || !profile) {
            await pushDiag({ phase: 'profile_lookup', username: emailOrUsername, profileError: String(profileError) });
            // To protect against enumeration, use the same error message
            throw new Error(t('auth.errors.invalid_credentials'));
          }

          if (profile.email) {
            await pushDiag({ phase: 'profile_has_email', username: emailOrUsername, email: profile.email });
            loginEmail = profile.email;
          } else if (profile.id) {
            // Attempt to read the email from auth.users using the profile id
            try {
              const { data: userRow, error: userErr } = await supabase
                .from('auth.users')
                .select('email')
                .eq('id', profile.id)
                .single();
              if (!userErr && userRow?.email) {
                await pushDiag({ phase: 'auth_users_lookup_success', username: emailOrUsername, id: profile.id, email: userRow.email });
                loginEmail = userRow.email;
              } else {
                await pushDiag({ phase: 'auth_users_lookup_no_email', username: emailOrUsername, id: profile.id, userErr: String(userErr) });
                throw new Error('no-email');
              }
            } catch (e) {
              await pushDiag({ phase: 'auth_users_lookup_error', username: emailOrUsername, id: profile.id, error: String(e) });
              // fallback: treat as invalid credentials to avoid enumeration
              throw new Error(t('auth.errors.invalid_credentials'));
            }
          } else {
            await pushDiag({ phase: 'profile_no_id', username: emailOrUsername, profile });
            throw new Error(t('auth.errors.invalid_credentials'));
          }
        }

        // Attempt to sign in with email
        const { data, error } = await supabase.auth.signInWithPassword({
          email: loginEmail,
          password,
        });

        if (error) {
          if (error.message.includes('Email not confirmed')) {
            throw new Error(t('auth.errors.email_not_verified'));
          } else if (error.message.includes('Invalid login credentials')) {
            throw new Error(t('auth.errors.invalid_credentials'));
          } else {
            // For other messages from Supabase, try to map or fallback to a generic translated message
            throw new Error(error.message || t('auth.errors.unexpected'));
          }
        }

        if (!data?.user) {
          throw new Error(t('auth.errors.no_user_found'));
        }

        // Check if user profile exists in the database. Select only known-good
        // columns to avoid PostgREST schema errors if the table schema is reduced.
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('first_name, last_name, username, birth_date, profile_image, applanguage, apptheme, selectedmodules, onboarding_completed')
          .eq('id', data.user.id)
          .single();

        if (profileError) {
          console.error('Error fetching user profile:', profileError);
        }

        // If the server profile has no selectedmodules, require a selected
        // plan from the client. If both server and local exported plans are
        // missing, cancel the auth (sign out) and surface a 'select plan' error.
        try {
          const hasServerFeatures = Array.isArray(profile?.selectedmodules) && profile.selectedmodules.length > 0;
          if (!hasServerFeatures) {
            // Check for locally exported plans by reading storage only. Do not
            // import the plan exporter from the auth context to avoid pulling
            // it into the startup graph.
            const raw = await AsyncStorage.getItem('@florescer:selected_plans');
            let hasLocalPlans = false;
            if (raw) {
              try { const parsed = JSON.parse(raw); hasLocalPlans = Array.isArray(parsed) && parsed.length > 0; } catch { hasLocalPlans = false; }
            }
            if (!hasLocalPlans) {
              throw new Error(t('onboarding.errors.no_plan_selected'));
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message === t('onboarding.errors.no_plan_selected')) throw e;
        }

        // The state will be automatically updated by the onAuthStateChange listener
        // No need to manually update state here. Fire-and-forget apply onboarding
        // defaults now that auth has completed and we have a confirmed user id.
        try {
          const uid = data.user.id;
          const { data: profileRow } = await supabase
            .from('profiles')
            .select('onboarding_completed')
            .eq('id', uid)
            .single();

          let onboardingCompleted = !!profileRow?.onboarding_completed;
          if (!onboardingCompleted) {
            // Attempt to apply onboarding modules synchronously with a short timeout
            // to reduce races where the app routes to onboarding before server-side
            // defaults have been applied. If this fails, continue without blocking.
            // Intentionally do NOT invoke applyOnboardingModulesIfNeeded from
            // the auth context — onboarding application is handled elsewhere
            // to keep this context minimal at startup.

            // Re-check the onboarding flag after the attempt
            try {
              const { data: refreshed } = await supabase
                .from('profiles')
                .select('onboarding_completed')
                .eq('id', uid)
                .single();
              onboardingCompleted = !!refreshed?.onboarding_completed;
            } catch (e) {
              // ignore re-check errors
            }
          }
        } catch (e) {
          // Non-critical; log for visibility
          console.warn('post-login: failed to trigger onboarding apply', e);
        }

        // After sign-in or in any flow that might apply onboarding modules, check for exported-plan data first
        try {
          // Only check presence of locally exported plans; do NOT import the planexport module here.
          // Importing the planexport module would bundle its dependencies at startup which we want to avoid.
          const raw = await AsyncStorage.getItem('@florescer:selected_plans');
          if (raw) {
            // previously we would apply onboarding modules here via planexport; this has been removed.
            // keep this branch intentionally empty to avoid bundling the planexport module.
          }
        } catch (e) {
          // ignore and continue; applying onboarding modules is optional
        }

        return data.user;
      } catch (error: any) {
        throw error;
      }
    },
    signInWithProvider: async (provider: string) => {
      try {
        const redirect = process.env.EXPO_PUBLIC_AUTH_REDIRECT_URL || 'exp://localhost:19000/--/auth/callback';
        const res = await supabase.auth.signInWithOAuth({ provider: provider as any, options: { redirectTo: redirect } });
        if (res.error) {
          console.error('OAuth start error (supabase):', res.error);
          throw res.error;
        }
        // On mobile and web, Supabase returns a URL we should open in the system/browser.
        const url = (res as any).data?.url || (res as any).url || null;
        if (url) {
          try {
            // Open the OAuth URL in the system browser. Removed dependency on
            // app/utils/openBrowser to avoid bundling that helper here.
            await Linking.openURL(url);
          } catch (e) {
            console.error('Failed to open OAuth url', e);
            throw e;
          }
        } else {
          // No URL returned - log and throw to surface to caller
          console.error('OAuth start: no url returned from supabase');
          throw new Error('OAuth start failed: no url');
        }
      } catch (e) {
        console.error('OAuth start error:', e);
        throw e;
      }
    },
    signOut: async () => {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
  try { await AsyncStorage.removeItem(LAST_SESSION_KEY); } catch (e) { /* ignore */ }
    },
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}