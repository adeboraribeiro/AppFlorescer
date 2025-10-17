import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSettings } from '../contexts/SettingsContext';
import i18n from '../i18n';
import MoreModulesModal from './MoreModulesModal';

type Props = { 
  isDarkMode?: boolean;
  enabledModules?: Array<{ id: string; labelKey: string; icon?: string; route?: string }>;
  visibleSlots?: boolean[];
};

export default function TabBarBackground({ isDarkMode = false, enabledModules = [], visibleSlots }: Props) {
  const { openSettings, isSettingsOpen } = useSettings();
  const [isMoreOpen, setIsMoreOpen] = React.useState(false);
  const [isNavigating, setIsNavigating] = React.useState(false);
  const navigationTimeout = React.useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const currentRoute = React.useRef<string>('/home'); // Initialize with home route
  // Sync currentRoute with actual router path to avoid stale state after programmatic navigation
  React.useEffect(() => {
    try {
      const path = (router && (router as any).pathname) ? (router as any).pathname : undefined;
      if (path && typeof path === 'string') currentRoute.current = path;
    } catch (e) {
      // ignore
    }
  }, []);
  const CLICK_TIMEOUT = 300; // 300ms timeout between clicks

  // Clear timeout on unmount
  React.useEffect(() => {
    return () => {
      if (navigationTimeout.current) {
        clearTimeout(navigationTimeout.current);
      }
    };
  }, []);
  // Use the shared i18n instance directly to avoid hook-related runtime issues
  const translateOrFallback = (key: string, fallback: string) => {
    try {
      const res = i18n.t(key);
      if (typeof res === 'string' && (res === key || res.trim() === '')) return fallback;
      return res as string;
    } catch (err) {
      return fallback;
    }
  };

  // Calculate default visibility - only show slots that have content or are fixed (Home/More)
  const defaultVisibility = Array(5).fill(false).map((_, idx) => {
    if (idx === 0) return true; // Home is always visible
    if (idx === 4) return true; // More is always visible
    return enabledModules[idx - 1] !== undefined; // Middle slots visible only if they have a module
  });
  const bgColor = isDarkMode ? '#0e2e2c' : '#ffffff';
  // subtle neutral shadow for light mode only
  const shadowColor = isDarkMode ? 'transparent' : '#000000';

  const TOTAL_SLOTS = 5;
  const BASE_MAX_WIDTH = 380; // matches original maxWidth

  // Build the list of slots to render based on enabled modules.
  // We must never render more than TOTAL_SLOTS slots.
  const modules = enabledModules || [];
  const slots: Array<{ type: 'home' | 'module' | 'more'; module?: { id: string; labelKey: string; icon?: string; route?: string } }> = [];
  // home
  slots.push({ type: 'home' });

  const maxModulesDirect = TOTAL_SLOTS - 1; // number of module slots available when including Home

  if (modules.length > maxModulesDirect) {
    // Too many modules: show first (maxModulesDirect - 1) modules then a More slot
    const direct = Math.max(0, maxModulesDirect - 1);
    modules.slice(0, direct).forEach((m) => slots.push({ type: 'module', module: m }));
    slots.push({ type: 'more' });
  } else {
    // Show modules directly up to the available slots
    modules.slice(0, maxModulesDirect).forEach((m) => slots.push({ type: 'module', module: m }));
  }

  let visibleCount = slots.length;
  // clamp visibleCount to TOTAL_SLOTS
  const clampCount = Math.min(visibleCount, TOTAL_SLOTS);

  if (clampCount === 0) return null;

  // computed width proportional to remaining slots (e.g. 4 -> 380 * 4/5)
  const computedWidth = Math.round(BASE_MAX_WIDTH * (clampCount / TOTAL_SLOTS));

  return (
    <View style={styles.wrapper} pointerEvents="box-none">
      {/* soft shadow layer (light mode only) */}
      {!isDarkMode && (
        <View style={[styles.shadow, { width: computedWidth, height: 65, borderRadius: 20 }]} pointerEvents="none" />
      )}

      {/* main background */}
      <View style={[styles.bg, { width: computedWidth, backgroundColor: bgColor }]} />

      {/* interactive slots overlay (only visible slots render) */}
      <View style={[styles.slotOverlay, { width: computedWidth }]}>
        {slots.slice(0, TOTAL_SLOTS).map((slot, idx) => {
          let iconName = 'ellipse';
          let label = 'Empty';

          if (slot.type === 'home') {
            iconName = 'home';
            label = translateOrFallback('tabs.home', 'Home');
          } else if (slot.type === 'more') {
            iconName = 'ellipsis-horizontal';
            label = translateOrFallback('tabs.more', 'More');
          } else if (slot.type === 'module' && slot.module) {
            iconName = slot.module.icon || 'ellipse';
            label = translateOrFallback(slot.module.labelKey, slot.module.id);
          }

          return (
            <TouchableOpacity
              key={`${slot.type}-${idx}-${slot.module ? slot.module.id : ''}`}
              style={[styles.slot, isNavigating && styles.disabledSlot]}
              activeOpacity={isNavigating ? 1 : 0.7}
              disabled={isNavigating}
              accessibilityRole="button"
              onPress={() => {
                if (isNavigating) return; // Prevent clicks while navigating
                setIsNavigating(true);

                // Clear any existing timeout
                if (navigationTimeout.current) {
                  clearTimeout(navigationTimeout.current);
                }

                const navigate = () => {
                  // Determine target route
                  const targetRoute = slot.type === 'home' ? '/home' :
                    (slot.type === 'module' && slot.module?.route) ? slot.module.route :
                    null;

                  // If it's the same route or it's the More button when settings are open, do nothing
            if (targetRoute === currentRoute.current || 
              (slot.type === 'more' && (isSettingsOpen || isMoreOpen))) {
                    setIsNavigating(false);
                    return;
                  }

                  // Update current route and navigate
                  if (targetRoute) {
                    currentRoute.current = targetRoute;
                    router.push(targetRoute as any);
                  } else if (slot.type === 'more') {
              // open MoreModulesModal instead of settings
              setIsMoreOpen(true);
                  }
                };

                navigate();

                // Set timeout to re-enable navigation
                navigationTimeout.current = setTimeout(() => {
                  setIsNavigating(false);
                }, CLICK_TIMEOUT);
              }}
            >
              <Ionicons name={iconName as any} size={24} color={'#4dccc1'} />
              <Text style={[styles.slotLabel, { color: '#4dccc1' }]}>{label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
  <MoreModulesModal isVisible={isMoreOpen} onClose={() => setIsMoreOpen(false)} enabledModules={enabledModules} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 25, // matches previous tabBar marginBottom
    alignItems: 'center',
    zIndex: 10,
  },
  shadow: {
  position: 'absolute',
  // match the bg box so the shadow surrounds the whole bar
  height: 75,
  borderRadius: 20,
  // neutral subtle shadow for light mode that spreads around the box
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 0 },
  shadowOpacity: 0.09,
  shadowRadius: 10,
  elevation: 6,
  },
  bg: {
    height: 75,
    borderRadius: 20,
    paddingBottom: 8,
    paddingTop: 8,
    opacity: 0.95,
  },
  slotOverlay: {
    position: 'absolute',
    height: 70,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  slot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotLabel: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#8e8e8e',
    marginTop: 4,
  },
  disabledSlot: {
    opacity: 0.5,
  },
});
