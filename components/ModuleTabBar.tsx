import { Ionicons } from '@expo/vector-icons';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { useRouter } from 'expo-router';
import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

export function getTabScreenOptions(theme: 'light' | 'dark'): BottomTabNavigationOptions {
  const isDarkMode = theme === 'dark';
  const activeTint = isDarkMode ? '#80E6D9' : '#4dccc1';
  const inactiveTint = isDarkMode ? '#80E6D9' : '#4dccc1';
  const labelColor = '#4dccc1';
  const background = isDarkMode ? '#0e2e2c' : '#ffffffff';

  return {
    tabBarActiveTintColor: activeTint,
    tabBarInactiveTintColor: inactiveTint,
    tabBarLabelStyle: {
      color: labelColor,
      fontSize: 12,
      fontWeight: "500" as const,
    },
    tabBarStyle: {
      backgroundColor: background,
      borderTopWidth: 0,
      borderRadius: 20,
      height: 75,
      marginBottom: 25,
      paddingBottom: 8,
      paddingTop: 8,
      opacity: 0.95,
    },
    tabBarItemStyle: {
      borderTopWidth: 0,
    },
  };
}

type TabRoute = {
  name: string;
  label: string;
  icon: string;
  iconOutline: string;
};

type ModuleTabBarProps = {
  routes: TabRoute[];
  currentRoute: string;
  isDarkMode?: boolean;
};

export function ModuleTabBar({ routes, currentRoute, isDarkMode }: ModuleTabBarProps) {
  const router = useRouter();

  return (
    <View style={[styles.tabBar, { 
      backgroundColor: isDarkMode ? '#0e2e2c' : '#ffffff',
      borderTopWidth: 0,
      borderRadius: 20,
      height: 75,
      marginBottom: 25,
      paddingBottom: 8,
      paddingTop: 8,
      opacity: 0.95,
    }]}>
      {routes.map((route) => {
        const isFocused = currentRoute === route.name.toLowerCase();
          const iconName = isFocused ? route.icon : route.iconOutline;        return (
          <TouchableOpacity
            key={route.name}
            accessibilityRole="button"
            accessibilityState={isFocused ? { selected: true } : {}}
            onPress={() => {
              if (!isFocused) {
                router.push(`/${route.name.toLowerCase()}` as any);
              }
            }}
            style={styles.tabButton}
            activeOpacity={0.85}
          >
            <Ionicons 
              name={iconName as any} 
              size={24} 
              color={isFocused ? '#4dccc1' : '#8e8e8e'} 
            />
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    marginHorizontal: 'auto',
  },
  tabButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
  },
});

export default null;
