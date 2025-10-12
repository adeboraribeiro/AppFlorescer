import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Animated, Dimensions, Easing, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../../contexts/ThemeContext';

interface Addiction {
  id: string;
  name: string;
  category: string;
  why_quitting: string;
  start_date: string;
  current_streak: number;
  longest_streak: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface CheckinData {
  checkin_date: string;
  mood: number;
  stayed_clean: boolean;
}

export default function AddictionsScreen() {
  const { theme } = useTheme();
  const isDarkMode = theme === 'dark';
  const [addictions, setAddictions] = useState<Addiction[]>([]);
  const [isNavigating, setIsNavigating] = useState(false);
  
  // Animation values for slide-in from right
  const { width: windowWidth } = Dimensions.get('window');
  const slideAnim = React.useRef(new Animated.Value(windowWidth)).current;
  const shadowFade = React.useRef(new Animated.Value(0)).current;

  // Run entrance animations when component mounts
  useEffect(() => {
    // Slide the page in from the right quickly.
    setIsNavigating(true);
    // animate slide and shadow in parallel; shadowFade uses JS driver so it can animate shadowOpacity
    Animated.parallel([
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(shadowFade, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: false,
      })
    ]).start(() => {
      // end navigation phase so any other animation-aware logic can resume
      setIsNavigating(false);
    });
  }, []);

  // Database functionality removed as tables do not exist

  return (
    <ScrollView style={[styles.scrollContainer, { backgroundColor: isDarkMode ? '#0A1E1C' : '#ffffffff' }]}>
      <Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
        <View style={styles.header}>
          <Text style={[styles.title, { color: '#4dccc1' }]}>Recovery Journey</Text>
          <Text style={[styles.subtitle, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>
            Every day is a step forward. Track your progress and build the life you want.
          </Text>
        </View>

        {addictions.length > 0 ? (
          <>
            <View style={styles.statsGrid}>
              <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#0a1e1c' : '#ffffff', borderColor: '#4dccc1' }]}>
                <Ionicons name="trending-up" size={24} color="#4dccc1" />
                <Text style={[styles.statValue, { color: '#4dccc1' }]}>{addictions.length}</Text>
                <Text style={[styles.statLabel, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>Active Recoveries</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#0a1e1c' : '#ffffff', borderColor: '#4dccc1' }]}>
                <Ionicons name="calendar" size={24} color="#4dccc1" />
                <Text style={[styles.statValue, { color: '#4dccc1' }]}>
                  {Math.max(...addictions.map(a => a.current_streak), 0)}
                </Text>
                <Text style={[styles.statLabel, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>Best Current Streak</Text>
              </View>
              <View style={[styles.statCard, { backgroundColor: isDarkMode ? '#0a1e1c' : '#ffffff', borderColor: '#4dccc1' }]}>
                <Ionicons name="trophy" size={24} color="#4dccc1" />
                <Text style={[styles.statValue, { color: '#4dccc1' }]}>
                  {Math.max(...addictions.map(a => a.longest_streak), 0)}
                </Text>
                <Text style={[styles.statLabel, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>Personal Best</Text>
              </View>
            </View>

            <View style={styles.addictionsGrid}>
              {addictions.map((addiction) => (
                <View
                  key={addiction.id}
                  style={[
                    styles.addictionCard,
                    {
                      backgroundColor: isDarkMode ? '#0a1e1c' : '#ffffff',
                      borderColor: '#4dccc1'
                    }
                  ]}
                >
                  <Text style={[styles.addictionName, { color: '#4dccc1' }]}>{addiction.name}</Text>
                  <Text style={[styles.addictionCategory, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>
                    {addiction.category}
                  </Text>
                  <View style={styles.streakContainer}>
                    <Ionicons name="flame" size={20} color="#4dccc1" />
                    <Text style={[styles.streakText, { color: '#4dccc1' }]}>
                      {addiction.current_streak} days
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={[styles.checkinButton, { backgroundColor: '#4dccc1' }]}
                    onPress={() => {}}
                  >
                    <Text style={[styles.checkinButtonText, { color: isDarkMode ? '#0a1e1c' : '#ffffff' }]}>
                      Daily Check-in
                    </Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={[styles.emptyState, { backgroundColor: isDarkMode ? '#0a1e1c' : '#ffffff', borderColor: '#4dccc1' }]}>
            <Text style={{ fontSize: 40, marginBottom: 16 }}>🌱</Text>
            <Text style={[styles.emptyStateTitle, { color: '#4dccc1' }]}>Ready to begin your journey?</Text>
            <Text style={[styles.emptyStateText, { color: isDarkMode ? '#a0a0a0' : '#666666' }]}>
              Taking the first step is often the hardest. You're here, which means you're already on the right path.
            </Text>
            <TouchableOpacity
              style={[styles.startButton, { backgroundColor: '#4dccc1' }]}
              onPress={() => {}}
            >
              <Text style={[styles.startButtonText, { color: isDarkMode ? '#0a1e1c' : '#ffffff' }]}>
                Start Your First Recovery
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Animated.View>
    </ScrollView>
  );
}

const { width } = Dimensions.get('window');
const cardWidth = (width - 60) / 2;

const styles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
  },
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginHorizontal: 20,
    lineHeight: 24,
  },
  statsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 4,
    alignItems: 'center',
    borderWidth: 1,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    marginVertical: 8,
  },
  statLabel: {
    fontSize: 12,
    textAlign: 'center',
  },
  addictionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  addictionCard: {
    width: cardWidth,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
  },
  addictionName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  addictionCategory: {
    fontSize: 14,
    marginBottom: 12,
  },
  streakContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  streakText: {
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '500',
  },
  checkinButton: {
    borderRadius: 8,
    paddingVertical: 8,
    alignItems: 'center',
  },
  checkinButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
  emptyState: {
    alignItems: 'center',
    padding: 32,
    borderRadius: 16,
    borderWidth: 1,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 24,
  },
  startButton: {
    borderRadius: 8,
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  startButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
