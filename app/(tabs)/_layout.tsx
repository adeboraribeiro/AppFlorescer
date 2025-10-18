import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Slot, router, useSegments } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Animated, DeviceEventEmitter, PanResponder, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import ConfirmDeletionModal from '../../components/ConfirmDeletionModal';
import Header from '../../components/header';
import TabBar from '../../components/TabBar';
import { useSettings } from '../../contexts/SettingsContext';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import supabase from '../../lib/supabase';

// Lightweight in-memory cache so the ManageModules UI can reuse the already-loaded
// enabled modules from the tab bar without re-reading AsyncStorage.
let cachedEnabledModules: string[] | null = null;

const MODULES_KEY = 'enabledModules';
export const AVAILABLE_MODULES = [
  { id: 'Partnership', labelKey: 'modules.partnership', icon: 'people', route: '/partnership' },
  { id: 'Bromelia', labelKey: 'modules.bromelia', icon: 'flower', route: '/bromelia' },
  { id: 'Pomodoro', labelKey: 'modules.pomodoro', icon: 'timer', route: '/pomodoro' },
  { id: 'Journal', labelKey: 'modules.journal', icon: 'book', route: '/journal' },
  { id: 'Recovery', labelKey: 'modules.recovery', icon: 'heart', route: '/recovery' },
  { id: 'FocusMode', labelKey: 'modules.focusmode', icon: 'eye', route: '/focusmode' },
  { id: 'Planner', labelKey: 'modules.planner', icon: 'calendar', route: '/planner' },
  { id: 'TaskManager', labelKey: 'modules.taskmanager', icon: 'list', route: '/taskmanager' },
  { id: 'Habits', labelKey: 'modules.habits', icon: 'repeat', route: '/habits' },
  { id: 'MinimalApps', labelKey: 'modules.minimalapps', icon: 'apps', route: '/minimalapps' },
  { id: 'AppLimits', labelKey: 'modules.applimits', icon: 'stopwatch', route: '/applimits' },
  { id: 'MoodTracker', labelKey: 'modules.moodtracker', icon: 'happy', route: '/moodtracker' },
];

// Numeric encoding mapping: single-digit numeric codes mapped to module ids.
// Example: '12345' => ['Partnership','Bromelia','Pomodoro','Journal','Recovery']
const MODULE_NUM_TO_ID: Record<string, string> = {
  '1': 'Partnership',
  '2': 'Bromelia',
  '3': 'Pomodoro',
  '4': 'Journal',
  '5': 'Recovery',
  '6': 'FocusMode',
  '7': 'Planner',
  '8': 'TaskManager',
  '9': 'Habits',
  '10': 'MinimalApps',
  '11': 'AppLimits',
  '12': 'MoodTracker',
};

function normalizeToModuleIds(rawValue: any): string[] {
  // Accept many formats: string digits '12345', '0' means none; array of ids; array of numbers; comma-separated '1,2,3'
  try {
    if (rawValue == null) return [];

    // If it's an array, inspect contents
    if (Array.isArray(rawValue)) {
      // numeric array -> map numbers to ids
      const nums = rawValue.filter(v => typeof v === 'number' || (typeof v === 'string' && /^\d+$/.test(v))).map(String);
      if (nums.length === rawValue.length && nums.length > 0) {
        return nums.map(n => MODULE_NUM_TO_ID[n]).filter(Boolean);
      }

      // otherwise assume array of module id strings
      return rawValue.filter((v: any) => typeof v === 'string');
    }

    // If it's a number, map single number to id
    if (typeof rawValue === 'number') {
      const id = MODULE_NUM_TO_ID[String(rawValue)];
      return id ? [id] : [];
    }

    if (typeof rawValue === 'string') {
      const s = rawValue.trim();
      if (s === '0' || s === '') return [];

      // digits-only string '12345' or '1,2,3'
      if (/^\d+$/.test(s)) {
        return s.split('').map(ch => MODULE_NUM_TO_ID[ch]).filter(Boolean);
      }

      if (/^[\d,\s]+$/.test(s)) {
        return s.split(/[\s,]+/).map(x => MODULE_NUM_TO_ID[x]).filter(Boolean);
      }

      // fallback: maybe it's a JSON array stored as string
      try {
        const parsed = JSON.parse(s);
        return normalizeToModuleIds(parsed);
      } catch (_) {
        // otherwise it's a module id string
        return [s];
      }
    }

    return [];
  } catch (e) {
    console.warn('[normalizeToModuleIds] failed to normalize', e);
    return [];
  }
}

export async function getEnabledModuleIds(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(MODULES_KEY);
    if (!raw) return [];
    // Normalize accepts JSON arrays, digit-strings like '12345', numeric arrays, etc.
    try {
      const parsed = JSON.parse(raw);
      const normalized = normalizeToModuleIds(parsed);
      return normalized;
    } catch (e) {
      // raw is not JSON - try to normalize the raw string directly
      return normalizeToModuleIds(raw);
    }
  } catch (e) {
    console.warn('[ManageModules] getEnabledModuleIds failed', e);
    return []; // Return empty array on error
  }
}

import { ManageModulesProps } from '../../types/module-types';

export function ManageModules({ onClose, onMeasure }: ManageModulesProps) {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const { i18n } = useTranslation();
  const { t } = useTranslation();

  // Use user context so we can prefer server-stored selectedmodules
  const { userProfile, fetchUserProfile } = useUser();

  // Helper to build a full moduleOrder array (objects) where enabled ids appear first
  const buildOrderedModuleArray = (ids: string[]) => {
    try {
      const idSet = new Set(ids || []);
      // first, modules in the provided ids in that exact order
      const ordered = (ids || []).map(id => AVAILABLE_MODULES.find(m => m.id === id)).filter(Boolean) as any[];
      // then append remaining modules preserving default AVAILABLE_MODULES order
      const remaining = AVAILABLE_MODULES.filter(m => !idSet.has(m.id));
      return [...ordered, ...remaining];
    } catch (e) {
      return AVAILABLE_MODULES.slice();
    }
  };

  const [loading, setLoading] = useState(() => (cachedEnabledModules && cachedEnabledModules.length > 0) ? false : true);
  const [selected, setSelected] = useState<string[]>(() => (cachedEnabledModules && cachedEnabledModules.length > 0) ? cachedEnabledModules.slice() : []);
  const [moduleOrder, setModuleOrder] = useState(() => (cachedEnabledModules && cachedEnabledModules.length > 0) ? buildOrderedModuleArray(cachedEnabledModules) : []);
  const initialRef = useRef<string[] | null>(null);
  const initialOrderRef = useRef<string[] | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const saveAnim = useRef(new Animated.Value(0)).current;
  const saveRef = useRef<{ visibleSlots?: boolean[] }>({});
  const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);
  const swapAnimRefs = useRef<Record<string, Animated.Value>>({});
  const selectAnimRefs = useRef<Record<string, Animated.Value>>({});
  const positionAnimRefs = useRef<Record<string, Animated.Value>>({});
  const shrinkAnimRefs = useRef<Record<string, Animated.Value>>({});
  const popAnimRefs = useRef<Record<string, Animated.Value>>({});
  const [isAnimatingSwap, setIsAnimatingSwap] = useState(false);
  const [hiddenIds, setHiddenIds] = useState<Record<string, boolean>>({});
  const overlayYRefs = useRef<Record<string, Animated.Value>>({});
  const toggleProgressRefs = useRef<Record<string, Animated.Value>>({});
  const [overlayIds, setOverlayIds] = useState<string[]>([]);

  

  // Drag & reorder state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [placeholderIndex, setPlaceholderIndex] = useState<number | null>(null);
  // Swap mode state: when set, clicking another module will swap positions
  const [swapSourceId, setSwapSourceId] = useState<string | null>(null);
  const dragY = useRef(new Animated.Value(0)).current;
  const containerTop = useRef(0);
  const itemHeight = 64; // fallback approximate item height for calculations
  const [measuredItemHeight, setMeasuredItemHeight] = useState<number | null>(null);
  const computedItemHeight = measuredItemHeight ?? itemHeight;
  const currentToggleAnimRef = useRef<Animated.CompositeAnimation | null>(null);

  // Animate swap icon highlight when swapSourceId changes
  useEffect(() => {
    try {
      moduleOrder.forEach(m => {
        const id = typeof m === 'string' ? m : m.id;
        if (!swapAnimRefs.current[id]) swapAnimRefs.current[id] = new Animated.Value(id === swapSourceId ? 1 : 0);
  // immediate highlight (animations removed)
  try { swapAnimRefs.current[id].setValue(id === swapSourceId ? 1 : 0); } catch (e) { /* ignore */ }
      });
    } catch (e) {
      // ignore
    }
  }, [swapSourceId, moduleOrder]);

  const startIndexRef = useRef<number | null>(null);
  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => !!draggingId,
    onMoveShouldSetPanResponder: () => !!draggingId,
    onPanResponderMove: (_, gestureState) => {
      // Use start index + dy to compute placeholder
      if (startIndexRef.current == null) return;
      const delta = Math.round(gestureState.dy / itemHeight);
      const newIndex = Math.max(0, Math.min(moduleOrder.length - 1, startIndexRef.current + delta));
      if (placeholderIndex !== newIndex) setPlaceholderIndex(newIndex);
    },
    onPanResponderRelease: () => {
      if (draggingId != null && placeholderIndex != null) {
        const from = moduleOrder.findIndex(m => m.id === draggingId);
        let newOrder = moduleOrder.slice();
        const [moved] = newOrder.splice(from, 1);
        newOrder.splice(placeholderIndex, 0, moved);
        setModuleOrder(newOrder);
      }
      setDraggingId(null);
      setPlaceholderIndex(null);
      startIndexRef.current = null;
    }
  })).current;

  // animate swapping two items visually then update moduleOrder
  const animateSwap = (idxA: number, idxB: number) => {
    if (isAnimatingSwap) return;
    const aEntry = moduleOrder[idxA];
    const bEntry = moduleOrder[idxB];
    const idA = typeof aEntry === 'string' ? aEntry : aEntry.id;
    const idB = typeof bEntry === 'string' ? bEntry : bEntry.id;
    const startTopA = idxA * itemHeight;
    const startTopB = idxB * itemHeight;

  // prepare overlays (use values as translateY offsets)
  if (!overlayYRefs.current[idA]) overlayYRefs.current[idA] = new Animated.Value(startTopA);
  else overlayYRefs.current[idA].setValue(startTopA);
  if (!overlayYRefs.current[idB]) overlayYRefs.current[idB] = new Animated.Value(startTopB);
  else overlayYRefs.current[idB].setValue(startTopB);

    // hide originals by keeping placeholders
    setHiddenIds(prev => ({ ...prev, [idA]: true, [idB]: true }));
    setOverlayIds([idA, idB]);

    // immediate swap (animations removed)
    setIsAnimatingSwap(true);
    const newOrder = moduleOrder.slice();
    const tmp = newOrder[idxA];
    newOrder[idxA] = newOrder[idxB];
    newOrder[idxB] = tmp;
    setModuleOrder(newOrder);
    // cleanup overlays and unhide originals
    setOverlayIds([]);
    setHiddenIds(prev => {
      const next = { ...prev };
      delete next[idA];
      delete next[idB];
      return next;
    });
    setSwapSourceId(null);
    setIsAnimatingSwap(false);
  };

  const pillBackground = isDarkMode ? '#0E2E2C' : '#FFFFFF';
  const pillBorderColor = '#4dccc1';
  const saveDisabledBg = isDarkMode ? '#23403d' : '#cccccc';
  const saveDisabledTextColor = isDarkMode ? '#7ea99f' : '#999999';

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        // If the tab bar already loaded enabled modules, prefer that cached value to avoid re-reading storage.
        if (cachedEnabledModules && Array.isArray(cachedEnabledModules)) {
          const ids = cachedEnabledModules;
          setSelected(ids);
          initialRef.current = ids.slice();
          const newModuleOrder = buildOrderedModuleArray(ids);
          setModuleOrder(newModuleOrder);
          initialOrderRef.current = ids.slice();
          setLoading(false);
          return;
        }

        // Prefer server-stored selected modules from userProfile when available.
        // Support both the new camelCase `selectedModules` and the legacy `selectedmodules` key.
        const serverSel = (userProfile as any)?.selectedModules ?? (userProfile as any)?.selectedmodules;
        if (userProfile && Array.isArray(serverSel)) {
          const ids = normalizeToModuleIds(serverSel);
          setSelected(ids);
          initialRef.current = ids.slice();
          // capture enabled order as it appears in moduleOrder (preserve the persisted order)
          const newModuleOrder = buildOrderedModuleArray(ids);
          setModuleOrder(newModuleOrder);
          initialOrderRef.current = ids.slice();
          setLoading(false);
          return;
        }

        const raw = await AsyncStorage.getItem(MODULES_KEY);
        if (!raw) {
          setSelected([]); // Start with no modules enabled
          initialRef.current = [];
          initialOrderRef.current = [];
        } else {
          // use normalizeToModuleIds which handles arrays, digit-strings, etc.
          let ids: string[] = [];
          try {
            const parsed = JSON.parse(raw);
            ids = normalizeToModuleIds(parsed);
          } catch (_) {
            ids = normalizeToModuleIds(raw);
          }
          setSelected(ids);
          initialRef.current = ids.slice();
          // Re-order the moduleOrder to reflect the stored enabled ids order
          const newModuleOrder = buildOrderedModuleArray(ids);
          setModuleOrder(newModuleOrder);
          // capture enabled order from the persisted ids
          initialOrderRef.current = ids.slice();
        }
      } catch (e) {
        console.warn('[ManageModules] load failed', e);
        setSelected([]); // On error, start with no modules
        initialRef.current = [];
      } finally {
        setLoading(false);
      }
    })();
  }, [userProfile]);

  // Listen for the tab bar loader event so we can update immediately if it finishes after we mount
  useEffect(() => {
    const sub = DeviceEventEmitter.addListener('enabledModulesLoaded', (modules?: string[]) => {
      if (Array.isArray(modules) && modules.length > 0) {
        const ids = modules;
        setSelected(ids);
        initialRef.current = ids.slice();
        const newModuleOrder = buildOrderedModuleArray(ids);
        setModuleOrder(newModuleOrder);
        initialOrderRef.current = ids.slice();
        setLoading(false);
      }
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    const curSel = (selected || []).slice().sort().join(',');
    const initSel = (initialRef.current || []).slice().sort().join(',');
    // compute current enabled order from moduleOrder
    const curOrder = moduleOrder.map(m => typeof m === 'string' ? m : m.id).filter(id => selected.includes(id)).join(',');
    const initOrder = (initialOrderRef.current || []).join(',');
    setHasChanges(curSel !== initSel || curOrder !== initOrder);
  }, [selected, moduleOrder]);

  // animate selection (toggle) crossfade for each module
  useEffect(() => {
    try {
      moduleOrder.forEach(m => {
        const id = typeof m === 'string' ? m : m.id;
        const isSel = selected.includes(id);
        if (!selectAnimRefs.current[id]) selectAnimRefs.current[id] = new Animated.Value(isSel ? 1 : 0);
  // immediate selection state (animations removed)
  try { selectAnimRefs.current[id].setValue(isSel ? 1 : 0); } catch (e) { /* ignore */ }
      });
    } catch (e) {
      // ignore
    }
  }, [selected, moduleOrder]);

  useEffect(() => {
  // immediate save animation replacement (instant value)
  try { saveAnim.setValue((hasChanges && !isSaving) ? 1 : 0); } catch (e) { /* ignore */ }
  }, [hasChanges, isSaving, isDarkMode]);

  const toggle = (id: string) => {
    if (id === 'Home') return; // Can't toggle Home
    // animate toggle so item visually moves between activated/deactivated groups
    const isSel = selected.includes(id);
    if (isSel) {
      // show confirmation before deactivating
      setDeletionTarget(id);
      setConfirmVisible(true);
      return;
    }
    animateToggle(id, !isSel);
  };

  // Deletion modal state
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [deletionTarget, setDeletionTarget] = useState<string | null>(null);

  // Toggle handler with ALL animations removed: immediate commit for both activation and deactivation.
  const animateToggle = (id: string, toSelected: boolean) => {
    if (isAnimatingSwap) return; // avoid conflicting interactions

    // Build current lists
    const idsInOrder = moduleOrder.map(m => (typeof m === 'string' ? m : m.id));
    const selectedBefore = idsInOrder.filter(i => selected.includes(i));

    const startSelCount = selectedBefore.length;
    const endSelCount = toSelected ? startSelCount + 1 : Math.max(0, startSelCount - 1);

    // compute final order after toggle
    const simulatedNext = (() => {
      const prevIds = moduleOrder.map(m => (typeof m === 'string' ? m : m.id));
      const next = prevIds.slice();
      const idx = next.indexOf(id);
      if (idx >= 0) next.splice(idx, 1);
  const insertAt = endSelCount; // place at final selected count so deactivations land at the top of inactive zone
      next.splice(insertAt, 0, id);
      return next;
    })();

    if (!toSelected) {
      // Deactivation: immediate commit with no slide animations
      const newOrder = simulatedNext.map(idStr => moduleOrder.find(m => (typeof m === 'string' ? m : m.id) === idStr) || { id: idStr, labelKey: idStr, icon: 'ellipse', route: '' });
      setModuleOrder(newOrder);
      setSelected(prev => prev.filter(x => x !== id));
      // cleanup any visual flags
      setOverlayIds([]);
      setHiddenIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      setIsAnimatingSwap(false);
    } else {
  // Activation: immediate commit
      const newOrder = simulatedNext.map(idStr => moduleOrder.find(m => (typeof m === 'string' ? m : m.id) === idStr) || { id: idStr, labelKey: idStr, icon: 'ellipse', route: '' });
      setModuleOrder(newOrder);

      setSelected(prev => {
        if (toSelected) {
          if (prev.includes(id)) return prev;
          return [...prev, id];
        }
        return prev.filter(x => x !== id);
      });

      // Reset any position offsets for all modules immediately
      moduleOrder.forEach((entry) => {
        const mid = typeof entry === 'string' ? entry : entry.id;
        try {
          if (!positionAnimRefs.current[mid]) positionAnimRefs.current[mid] = new Animated.Value(0);
          else positionAnimRefs.current[mid].setValue(0);
        } catch (e) { /* ignore */ }
      });

  // Activation: immediate commit (no slide animations)
  // (state updated above)

      // Clear overlays/hidden flags and set visual toggle progress to final state
      setOverlayIds([]);
      setHiddenIds(prev => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
      if (!toggleProgressRefs.current[id]) toggleProgressRefs.current[id] = new Animated.Value(toSelected ? 1 : 0);
      else {
        try { toggleProgressRefs.current[id].setValue(toSelected ? 1 : 0); } catch (e) { /* ignore */ }
      }

      setIsAnimatingSwap(false);
  // Activation path: no reserved spacer to update; selectedHeight already set above
    }
  };

  // No slide animations: nothing to sync

  const { closeSettings } = useSettings();

  const save = async () => {
    if (!hasChanges || isSaving) return;
    setIsSaving(true);
    setHasChanges(false);

  try {
      // First, save the selected modules state locally (store numeric array)
    const MODULE_ID_TO_NUM: Record<string, number> = {
  Partnership: 1,
  Bromelia: 2,
  Pomodoro: 3,
  Journal: 4,
  Recovery: 5,
  FocusMode: 6,
  Planner: 7,
  TaskManager: 8,
  Habits: 9,
  MinimalApps: 10,
  AppLimits: 11,
  MoodTracker: 12,
    };

  // Persist enabled module ids in the current moduleOrder order (filter to selected)
  const orderedEnabled = moduleOrder.map(m => (typeof m === 'string' ? m : m.id)).filter(id => selected.includes(id));
  const numericSelection = orderedEnabled.map(id => MODULE_ID_TO_NUM[id]).filter((n): n is number => typeof n === 'number');
  await AsyncStorage.setItem(MODULES_KEY, JSON.stringify(numericSelection));

  // Persist selected modules to the user's profile (selectedmodules) as integer array
      try {
        const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const uid = user.id;
    const { error: updErr } = await supabase
    .from('profiles')
    .update({ selectedmodules: numericSelection })
      .eq('id', uid);
          if (updErr) {
    console.warn('[ManageModules] failed to persist selectedmodules to profile:', updErr);
          } else {
            // refresh user context so switches and layout reflect DB state
            try { await fetchUserProfile(); } catch (e) { /* ignore */ }
          }
        }
      } catch (dbErr) {
    console.warn('[ManageModules] error persisting selectedmodules:', dbErr);
      }

      // Then compute visibility based on ENABLED modules only
      const newVisible = Array(5).fill(false);
      newVisible[0] = true; // Home always visible
      newVisible[4] = true; // More always visible

      // Only fill middle slots if there are selected modules
      if (selected.length > 0) {
        const enabledModules = AVAILABLE_MODULES
          .filter(mod => selected.includes(mod.id))
          .slice(0, 3);
        enabledModules.forEach((_, i) => {
          newVisible[i + 1] = true;
        });
      }

      // store pending visibility so the save flow can emit it
      if (saveRef.current) saveRef.current.visibleSlots = newVisible;

      // emit after a short delay so splash UI can show
      setTimeout(() => {
        // include orderedEnabled so listeners can preserve order if they care
        const orderedEnabled = moduleOrder.map(m => (typeof m === 'string' ? m : m.id)).filter(id => selected.includes(id));
        DeviceEventEmitter.emit('enabledModulesUpdated', newVisible, orderedEnabled);
  DeviceEventEmitter.emit('openSettingsSection', 'General ');
  // Navigate to the splash route inside the (tabs) group where the splash component actually lives
  // After settings/save flows, prefer routing to the Home screen when authenticated.
  router.push('/(tabs)/home');

        setTimeout(() => {
          setIsSaving(false);
        }, 200);
      }, 400);

  // update initial snapshots so hasChanges reflects current saved state (including order)
  initialRef.current = selected.slice();
  initialOrderRef.current = moduleOrder.map(m => (typeof m === 'string' ? m : m.id)).filter(id => selected.includes(id));
    } catch (e) {
      console.warn('[ManageModules] save failed', e);
      setIsSaving(false);
    }
  };

  const measuredReportedRef = useRef(false);

  if (loading) return <ActivityIndicator size="small" color={isDarkMode ? '#4dccc1' : '#4dccc1'} />;

  return (
    <View {...(!confirmVisible ? panResponder.panHandlers : {})} style={{ paddingHorizontal: 16 }} onLayout={(e) => {
      try {
        const h = e.nativeEvent.layout.height;
        if (!measuredReportedRef.current && onMeasure && h) {
          measuredReportedRef.current = true;
          onMeasure(h);
        }
      } catch (err) { /* ignore */ }
    }}>
  {(() => {
    // Split moduleOrder into activated (selected) and deactivated lists while preserving order
    const normalizeEntry = (modEntry: any) => {
      if (modEntry == null) return { id: String(modEntry), labelKey: String(modEntry), icon: 'ellipse', route: '' };
      if (typeof modEntry === 'number') {
        const id = MODULE_NUM_TO_ID[String(modEntry)];
        return AVAILABLE_MODULES.find(m => m.id === id) || { id: String(id || modEntry), labelKey: String(id || modEntry), icon: 'ellipse', route: '' };
      }
      if (typeof modEntry === 'string') {
        if (/^\d+$/.test(modEntry)) {
          const id = MODULE_NUM_TO_ID[modEntry];
          return AVAILABLE_MODULES.find(m => m.id === id) || { id: String(id || modEntry), labelKey: String(id || modEntry), icon: 'ellipse', route: '' };
        }
        return AVAILABLE_MODULES.find(m => m.id === modEntry) || { id: modEntry, labelKey: modEntry, icon: 'ellipse', route: '' };
      }
      return modEntry as any;
    };

    const buildIconName = (module: any) => {
      if (module && module.icon && typeof module.icon === 'string') return module.icon;
      const id = (module.id || '').toLowerCase();
      if (id.includes('home')) return 'home';
      if (id.includes('message')) return 'chatbubbles';
      if (id.includes('bromelia') || id.includes('bromel')) return 'flower';
      if (/pomo|timer/.test(id)) return 'timer';
      if (id.includes('journal') || id.includes('book')) return 'book';
      if (id.includes('addiction')) return 'heart';
      return 'ellipse';
    };

    const selectedList = moduleOrder.map(normalizeEntry).filter(m => selected.includes(m.id));
    const unselectedList = moduleOrder.map(normalizeEntry).filter(m => !selected.includes(m.id));

    const dividerColor = isDarkMode ? '#183b38' : '#e6e6e6';

  // inner row rendering (no positioning wrapper)
  const renderRowInner = (module: any) => {
    const iconName = buildIconName(module);
    const sel = selected.includes(module.id);
    const isSwapSource = swapSourceId === module.id;
    const coolOutline = '#7ef3e8';
    const containerBorderColor = isSwapSource ? coolOutline : (sel ? '#4dccc1' : '#cccccc');
    const iconColor = sel ? '#4dccc1' : '#cccccc';
    const textColor = sel ? '#4dccc1' : '#cccccc';
    const toggleBorderColor = sel ? '#e54848' : '#4dccc1';
    const toggleIconColor = sel ? '#e54848' : '#4dccc1';

    return (
      <View onLayout={(e) => {
        try {
          const h = e.nativeEvent.layout.height;
          if (!measuredItemHeight && h) setMeasuredItemHeight(h);
        } catch (err) { /* ignore */ }
      }} style={[styles.settingItem, { backgroundColor: pillBackground, borderColor: containerBorderColor, borderWidth: 1 }]}>            
        <View style={styles.settingLeft}>
          <Ionicons name={(sel ? iconName : iconName.endsWith('-outline') ? iconName : `${iconName}-outline`) as any} size={24} color={iconColor} style={[styles.icon]} />
          <Text style={[styles.settingText, { color: textColor }]}>{i18n.t(module.labelKey || module.id)}</Text>
        </View>

        <View style={styles.rightControls}>
              {(() => {
            const id = module.id;
            if (!selectAnimRefs.current[id]) selectAnimRefs.current[id] = new Animated.Value(sel ? 1 : 0);
            const anim = selectAnimRefs.current[id];
            const addOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
            const removeOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });
            const borderOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

            return (
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { borderColor: toggleBorderColor, backgroundColor: 'transparent' }
                ]}
                    delayPressIn={0}
                    onPressIn={() => {
                      // immediate visual feedback only when activating (don't flip visual for deactivation because we show a confirm modal)
                      try { if (!sel) anim.setValue(1); } catch (e) { /* ignore */ }
                    }}
                    onPress={() => {
                      // route toggle through animateToggle for smooth animation
                      try { toggle(module.id); } catch (e) { /* fallback */ toggle(module.id); }
                    }}
              >
                <Animated.View style={{ position: 'absolute', opacity: addOpacity }}>
                  <Ionicons name={'add' as any} size={18} color={toggleIconColor} />
                </Animated.View>
                <Animated.View style={{ opacity: removeOpacity }}>
                  <Ionicons name={'remove' as any} size={18} color={toggleIconColor} />
                </Animated.View>
                {/* animated red overlay border */}
                <Animated.View style={{ position: 'absolute', top: -1, left: -1, right: -1, bottom: -1, borderRadius: 10, borderWidth: 1, borderColor: '#e54848', opacity: borderOpacity }} pointerEvents="none" />
              </TouchableOpacity>
            );
          })()}

          <TouchableOpacity
            style={styles.dragHandle}
            onPress={() => {
              const sel = selected.includes(module.id);
              // when module is disabled, short-press should be unselectable
              if (!sel) return;
              const id = module.id;
              // immediate visual feedback: ensure anim exists and set to 1 synchronously when selecting
              if (!swapAnimRefs.current[id]) swapAnimRefs.current[id] = new Animated.Value(0);

              // Swap mode: if none selected, mark this as source and immediately show highlight
              if (!swapSourceId) {
                setSwapSourceId(module.id);
                try { swapAnimRefs.current[id].setValue(1); } catch (e) { /* ignore */ }
                return;
              }

              if (swapSourceId === module.id) {
                // cancel - clear highlight immediately
                setSwapSourceId(null);
                try { swapAnimRefs.current[id].setValue(0); } catch (e) { /* ignore */ }
                return;
              }

              const idxA = moduleOrder.findIndex(m => (typeof m === 'string' ? m : m.id) === swapSourceId);
              const idxB = moduleOrder.findIndex(m => (typeof m === 'string' ? m : m.id) === module.id);
              if (idxA >= 0 && idxB >= 0 && idxA !== idxB) {
                // start swap (do not mark the target as selected) — only animate
                animateSwap(idxA, idxB);
              }
            }}
            onLongPress={() => {
              // preserve existing drag behavior when long-pressing
              const absIndex = moduleOrder.findIndex(m => (typeof m === 'string' ? m : m.id) === module.id);
              setDraggingId(module.id);
              setPlaceholderIndex(absIndex);
              startIndexRef.current = absIndex;
            }}
            accessibilityState={{ disabled: !selected.includes(module.id) }}
          >
            {(() => {
              // ensure an Animated.Value exists for this module
              const id = module.id;
              if (!swapAnimRefs.current[id]) swapAnimRefs.current[id] = new Animated.Value(swapSourceId === id ? 1 : 0);
              const anim = swapAnimRefs.current[id];

              const swapOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
              const checkOpacity = anim.interpolate({ inputRange: [0, 1], outputRange: [0, 1] });

              // color layers: normal + highlight overlay (highlight fades in smoothly)
              const normalColor = selected.includes(module.id) ? '#4dccc1' : '#cccccc';
              const highlightColor = '#7ef3e8';

              return (
                <Animated.View style={{ alignItems: 'center', justifyContent: 'center' }}>
                  <Animated.View style={{ position: 'absolute', opacity: swapOpacity }}>
                    <Ionicons name={'swap-horizontal' as any} size={22} color={normalColor} />
                    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: anim }}>
                      <Ionicons name={'swap-horizontal' as any} size={22} color={highlightColor} />
                    </Animated.View>
                  </Animated.View>
                  <Animated.View style={{ opacity: checkOpacity }}>
                    <Ionicons name={'checkmark-circle' as any} size={22} color={normalColor} />
                    <Animated.View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, opacity: anim }}>
                      <Ionicons name={'checkmark-circle' as any} size={22} color={highlightColor} />
                    </Animated.View>
                  </Animated.View>
                </Animated.View>
              );
            })()}
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  const renderRow = (module: any) => {
    const id = module.id;
    if (!positionAnimRefs.current[id]) positionAnimRefs.current[id] = new Animated.Value(0);

    // decide scale animation: shrink (1->0) or pop (0->1)
    const scaleAnim = shrinkAnimRefs.current[id] ?? popAnimRefs.current[id] ?? null;
    const scaleStyle = scaleAnim ? { transform: [{ translateY: positionAnimRefs.current[id] }, { scaleY: scaleAnim }] } : { transform: [{ translateY: positionAnimRefs.current[id] }] };
    const opacityStyle = scaleAnim ? { opacity: scaleAnim } : {};

    return (
      <Animated.View key={module.id} style={[scaleStyle, { width: '100%' }, opacityStyle]}>
        {renderRowInner(module)}
      </Animated.View>
    );
  };


    return (
      <>
        {/* Selected list (no slide animations) */}
        {selectedList.map(m => hiddenIds[m.id] ? (
          <View key={`ph-${m.id}`} style={[styles.settingItem, { height: computedItemHeight, opacity: 0 }]} />
        ) : renderRow(m))}

        {/* Divider sits in normal flow between selected and unselected lists so it doesn't cover items. */}
        {selectedList.length > 0 && unselectedList.length > 0 ? (
          <View style={[styles.divider, { backgroundColor: dividerColor }]} />
        ) : null}

        {unselectedList.map(m => hiddenIds[m.id] ? (
          <View key={`ph-${m.id}`} style={[styles.settingItem, { height: computedItemHeight, opacity: 0 }]} />
        ) : renderRow(m))}

        {/* overlays */}
  {/* overlays removed: no slide/overlay animations */}
      </>
    );
  })()}

      {(() => {
        const disabled = !hasChanges || isSaving;
        // animated background color (disabled -> active) with distinct light/dark values
        const saveActiveBg = isDarkMode ? 'rgba(77,204,193,0.12)' : 'rgba(77,204,193,0.12)';
        const saveDisabledBgTrans = isDarkMode ? 'rgba(35,64,61,0.12)' : 'rgba(204,204,204,0.12)';
        const bgColor = saveAnim.interpolate({
          inputRange: [0, 1],
          outputRange: [saveDisabledBgTrans, saveActiveBg]
        });
        const textColor = saveAnim.interpolate({ inputRange: [0, 1], outputRange: [saveDisabledTextColor, '#4DCCC1'] });

        // alias local save to match GeneralSettings exact copy
        const handleSave = save;

        return (
          <AnimatedTouchable
            activeOpacity={disabled ? 1 : 0.85}
            style={[
              styles.saveButton,
              {
                backgroundColor: bgColor,
                borderWidth: 0.7,
                opacity: disabled ? 0.6 : (isSaving ? 0.9 : 1),
              },
              disabled ? { borderColor: '#9CCFC8' } : { borderColor: '#4DCCC1' }
            ]}
            onPress={handleSave}
            disabled={disabled}
          >
            {isSaving ? (
              <ActivityIndicator size="small" color="#4DCDC2" />
            ) : (
              <Animated.Text style={[styles.saveButtonText, { color: textColor }]}>
                {t('settings.save_changes')}
              </Animated.Text>
            )}
          </AnimatedTouchable>
        );
      })()}
    {/* Confirm deletion modal for disabling a selected module */}
    <ConfirmDeletionModal
      isVisible={confirmVisible}
      moduleLabel={deletionTarget ? i18n.t((AVAILABLE_MODULES.find(m => m.id === deletionTarget) || { labelKey: deletionTarget }).labelKey || deletionTarget) : undefined}
      onClose={() => {
        setConfirmVisible(false);
        setDeletionTarget(null);
      }}
      onConfirm={() => {
        if (deletionTarget) {
          // perform the toggle to deactivate immediately
          animateToggle(deletionTarget, false);
        }
        setConfirmVisible(false);
        setDeletionTarget(null);
      }}
    />

    </View>

  );
}

const styles = StyleSheet.create({
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    borderRadius: 28,
    paddingHorizontal: 16,
    marginVertical: 4,
    borderWidth: 1,
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: { 
    width: 24,
    height: 24,
    marginRight: 12,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  settingText: { 
    fontSize: 16 
  },
  saveButton: {
  backgroundColor: 'transparent',
  height: 50,
  width: '100%',
  paddingHorizontal: 12,
  borderRadius: 15,
  justifyContent: 'center',
  alignItems: 'center',
  marginTop: 20,
  marginBottom: 20,
  borderWidth: 0.7,
  borderColor: '#4dccc1',
  },
  saveButtonDisabled: {
    backgroundColor: '#cccccc',
  },
  saveButtonText: {
    color: '#4DCCC1',
    fontSize: 16,
    fontWeight: '600',
  },
  saveButtonTextDisabled: {
    color: '#9CCFC8',
    fontSize: 16,
    fontWeight: '600',
  },
  rightControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  toggleButton: {
    borderWidth: 1,
    borderRadius: 10,
  paddingHorizontal: 10,
  paddingVertical: 6,
  marginRight: 8,
  minWidth: 34,
  alignItems: 'center',
  justifyContent: 'center',
  },
  dragHandle: {
    padding: 8,
  },
  divider: {
    height: 1,
    marginVertical: 12,
    width: '100%',
    borderRadius: 1,
  },
});

export default function TabsLayoutA() {
  const { openSettings } = useSettings();
  const { theme } = useTheme();
  const { userProfile } = useUser();
  const segments = useSegments();
  // Hide header/tabbar when route segment begins with 'ign-' or when viewing the ent-editor route
  const activeSegment = Array.isArray(segments) && segments.length > 0 ? String(segments[segments.length - 1]) : '';
  const suppressChrome = activeSegment.startsWith('ign-') || activeSegment === 'ent-editor';
  // Remember previous active segment so we can enforce returning to journal when ent-editor unmounts
  const prevActiveSegmentRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    try {
      const prev = prevActiveSegmentRef.current;
      if (prev === 'ent-editor' && activeSegment !== 'ent-editor') {
        // ent-editor was active and now is not — ensure we end up at /journal so TabBar state aligns
        try { router.replace('/journal'); } catch (e) { /* ignore */ }
      }
    } catch (e) { /* ignore */ }
    prevActiveSegmentRef.current = activeSegment;
  }, [activeSegment]);
  const [enabledModules, setEnabledModules] = useState<string[]>([]);
  const [visibleSlots, setVisibleSlots] = useState<boolean[]>(Array(5).fill(true));
  // Global overlay state: screens can request an overlay by emitting events
  const [overlay, setOverlay] = useState<{ name: string; props?: any; component?: React.ComponentType<any> } | null>(null);

  const [overlayComp, setOverlayComp] = useState<React.ComponentType<any> | null>(null);

  useEffect(() => {
    const showSub = DeviceEventEmitter.addListener('globalOverlayShow', (payload: any) => {
  try { setOverlay(payload); } catch (e) { /* ignore */ }
    });

    const hiddenSub = DeviceEventEmitter.addListener('globalOverlayHidden', () => {
      // overlay finished hiding; clear host state
      setOverlay(null);
    });

    return () => { showSub.remove(); hiddenSub.remove(); };
  }, []);

  // When overlay changes, lazy-load the component module to avoid circular import errors
  useEffect(() => {
    let mounted = true;
    if (!overlay) {
      setOverlayComp(null);
      return;
    }
    // If callers directly provide a component in the payload, use it (journal will import and pass the component).
    if (overlay.component) {
      const comp = overlay.component as React.ComponentType<any>;
      setOverlayComp(() => comp);
    } else if (overlay.name === 'entcreator' || overlay.name === 'edit-entry') {
      // Backwards-compatible dynamic import if a name is provided. Prefer callers to import and pass the component.
      import('../../components/entcreator')
        .then(mod => {
          if (mounted) setOverlayComp(() => mod.default || null);
        })
        .catch(err => {
          console.warn('[TabsLayout] failed to import entcreator', err);
          if (mounted) setOverlayComp(null);
        });
    } else {
      setOverlayComp(null);
    }
    return () => { mounted = false; };
  }, [overlay]);

  // If an editor overlay (entcreator / edit-entry) closes, enforce routing back to /journal
  const prevOverlayNameRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    try {
      const prev = prevOverlayNameRef.current;
      const name = overlay?.name ?? null;
      // Detect transition from overlay -> null
      if (prev && !name) {
        if (prev === 'entcreator' || prev === 'edit-entry' || prev === 'edit-entry') {
          try { router.replace('/journal'); } catch (e) { /* ignore */ }
        }
      }
      prevOverlayNameRef.current = name;
    } catch (e) { /* ignore */ }
  }, [overlay]);

  useEffect(() => {
    // initializer that prefers server-stored selectedmodules, falls back to AsyncStorage
    const loadModules = async (newVisibility?: boolean[]) => {
      try {
        // Prefer persisted selection from the user's profile if available

        const serverSel = (userProfile as any)?.selectedModules ?? (userProfile as any)?.selectedmodules;
        if (userProfile && Array.isArray(serverSel)) {
          // Normalize numeric arrays (e.g., [2,4]) or id arrays (['Bromelia']) into module ids
          const modules = normalizeToModuleIds(serverSel);
          setEnabledModules(modules);
          cachedEnabledModules = modules;
          DeviceEventEmitter.emit('enabledModulesLoaded', modules);

          if (newVisibility) {
            setVisibleSlots(newVisibility);
            return;
          }

          // compute default visibility based on enabled modules
          const vis = Array(5).fill(false);
          vis[0] = true; // Home fixed
          vis[4] = true; // More fixed
          const middle = AVAILABLE_MODULES.filter(mod => modules.includes(mod.id)).slice(0, 3);
          middle.forEach((_, i) => { vis[i + 1] = true; });
          setVisibleSlots(vis);
          return;
        }

  // Fallback: read from AsyncStorage
  const modules = await getEnabledModuleIds();
  setEnabledModules(modules);
  cachedEnabledModules = modules;
  DeviceEventEmitter.emit('enabledModulesLoaded', modules);
        if (newVisibility) {
          setVisibleSlots(newVisibility);
        } else {
          const vis = Array(5).fill(false);
          vis[0] = true;
          vis[4] = true;
          const middle = AVAILABLE_MODULES.filter(mod => modules.includes(mod.id)).slice(0, 3);
          middle.forEach((_, i) => { vis[i + 1] = true; });
          setVisibleSlots(vis);
        }
      } catch (err) {
        console.warn('[TabsLayout] loadModules failed', err);
      }
    };

    // initial load
    loadModules();

    // keep existing DeviceEventEmitter behavior so ManageModules.save can still broadcast
    const subscription = DeviceEventEmitter.addListener('enabledModulesUpdated', (newVisibility?: boolean[], orderedEnabled?: string[]) => {
      if (Array.isArray(orderedEnabled) && orderedEnabled.length > 0) {
        // Apply orderedEnabled directly to enabledModules state (exported custom order)
        setEnabledModules(orderedEnabled);

        // If caller also provided visibility array, use it; otherwise compute visibility from orderedEnabled
        if (Array.isArray(newVisibility)) {
          setVisibleSlots(newVisibility);
        } else {
          const vis = Array(5).fill(false);
          vis[0] = true;
          vis[4] = true;
          const middle = AVAILABLE_MODULES.filter(mod => orderedEnabled.includes(mod.id)).slice(0, 3);
          middle.forEach((_, i) => { vis[i + 1] = true; });
          setVisibleSlots(vis);
        }
        return;
      }

      loadModules(newVisibility);
    });

    return () => subscription.remove();
  }, [userProfile]);

  return (
    <>
      {!suppressChrome ? <Header /> : null}
      {/* Render nested routes */}
      <Slot />

      {/* Background-only tab bar visual */}
      {!suppressChrome ? (
        <TabBar 
          isDarkMode={theme === 'dark'} 
          visibleSlots={visibleSlots}
          enabledModules={enabledModules.map(id => {
            const mod = AVAILABLE_MODULES.find(m => m.id === id) || { id, labelKey: id, icon: 'ellipse', route: '' };
            return { id: mod.id, labelKey: mod.labelKey, icon: mod.icon, route: mod.route };
          })}
        />
      ) : null}
      {/* Global overlay host - renders overlays above header/slot/tabbar */}
      {overlay && overlayComp ? (
        // Host overlay in a full-screen absolute container so it covers header/tabbar
        <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, zIndex: 99999 }} pointerEvents="box-none">
          {React.createElement(overlayComp, { ...(overlay.props || {}) })}
        </View>
      ) : null}
    </>
  );
}