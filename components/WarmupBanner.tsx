import React, { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text, ViewStyle } from 'react-native';

type Props = {
  message?: string;
  duration?: number; // visible duration in ms (excluding fades)
  onFinish?: () => void;
  style?: ViewStyle;
};

export default function WarmupBanner({
  message = 'The servers are warming up, Bromélia may take up to 60s to respond. Hang tight',
  duration = 3000,
  onFinish,
  style,
}: Props) {
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(8)).current;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const seq = Animated.sequence([
      Animated.parallel([
        Animated.timing(opacity, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: 0, duration: 500, useNativeDriver: true }),
      ]),
      Animated.delay(duration),
      Animated.parallel([
        Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }),
        Animated.timing(translateY, { toValue: -8, duration: 500, useNativeDriver: true }),
      ]),
    ]);

    seq.start(() => {
      setVisible(false);
      onFinish && onFinish();
    });

    return () => seq.stop();
  }, [opacity, translateY, duration, onFinish]);

  if (!visible) return null;

  return (
    <Animated.View style={[styles.container, style, { opacity, transform: [{ translateY }] }]}> 
      <Text style={styles.text}>{message}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 70, // moved down ~50px per request
    backgroundColor: 'rgba(0,0,0,0.4)', // dark bg at 40% opacity
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    maxWidth: '90%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    color: '#E6FFF9',
    fontSize: 13,
    textAlign: 'center',
  },
});
