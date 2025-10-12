import React from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';

export const LoadingOverlay = ({ loadingText, isDark, opacity = 1 }: { loadingText?: string, isDark?: boolean, opacity?: number | Animated.AnimatedInterpolation<number> }) => {
  return (
    <Animated.View style={[
      styles.loadingOverlay, 
      { 
        opacity,
        backgroundColor: isDark ? '#0A1E1C' : '#F5F5F5'
      }
    ]}>
      <View style={[styles.loadingContainer, { backgroundColor: isDark ? 'rgba(14, 46, 44, 0.95)' : 'rgba(255, 255, 255, 0.95)' }]}>
        <ActivityIndicator size="large" color="#80E6D9" />
        {loadingText && <Text style={[styles.loadingText, { color: isDark ? '#FFFFFF' : '#0A1E1C' }]}>{loadingText}</Text>}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  loadingOverlay: {
    position: 'absolute',
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9999,
  },
  loadingContainer: {
    borderRadius: 12,
    padding: 24,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    fontWeight: '500',
  },
});
