import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, Easing, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { supabase } from '../../lib/supabase';

interface PomodoroSession {
  id: string;
  work_duration_minutes: number;
  break_duration_minutes: number;
  total_cycles: number;
  current_cycle: number;
  current_phase: 'work' | 'break';
  time_remaining_seconds: number;
  is_active: boolean;
  is_paused: boolean;
  started_at: string;
}

export default function Pomodoro() {
  const [session, setSession] = useState<PomodoroSession | null>(null);
  const [workMinutes, setWorkMinutes] = useState(25);
  const [breakMinutes, setBreakMinutes] = useState(5);
  const [totalCycles, setTotalCycles] = useState(1);
  const [timeRemaining, setTimeRemaining] = useState(0);
  const [editingWork, setEditingWork] = useState(false);
  const [editingBreak, setEditingBreak] = useState(false);
  const [workInput, setWorkInput] = useState('25');
  const [breakInput, setBreakInput] = useState('5');
  const [isNavigating, setIsNavigating] = useState(false);

  // Animation values for slide-in from right
  const { width: windowWidth } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(windowWidth)).current;
  const shadowFade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    loadActiveSession();

    // Run entrance animations when component mounts
    setIsNavigating(true);
    // animate slide and shadow in parallel
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
      setIsNavigating(false);
    });
  }, []);

  useEffect(() => {
    let intervalId: number;

    if (session?.is_active && !session.is_paused) {
      intervalId = setInterval(async () => {
        if (timeRemaining > 0) {
          const newTime = timeRemaining - 1;
          setTimeRemaining(newTime);
          
          // Update database every 10 seconds
          if (newTime % 10 === 0) {
            await updateSessionInDB({ time_remaining_seconds: newTime });
          }
        } else {
          // Phase complete
          await handlePhaseComplete();
        }
      }, 1000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [session, timeRemaining]);

  const loadActiveSession = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from('pomodoro_sessions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .single();

      if (data) {
        const sessionData: PomodoroSession = {
          ...data,
          current_phase: data.current_phase as 'work' | 'break'
        };
        setSession(sessionData);
        setTimeRemaining(data.time_remaining_seconds);
        setWorkMinutes(data.work_duration_minutes);
        setBreakMinutes(data.break_duration_minutes);
        setTotalCycles(data.total_cycles);
        setWorkInput(data.work_duration_minutes.toString());
        setBreakInput(data.break_duration_minutes.toString());
      }
    } catch (error) {
      console.log('No active session found');
    }
  };

  const updateSessionInDB = async (updates: Partial<PomodoroSession>) => {
    if (!session) return;

    try {
      const { error } = await supabase
        .from('pomodoro_sessions')
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq('id', session.id);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating session:', error);
    }
  };

  const startTimer = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        Alert.alert('Error', 'Please log in to use the timer');
        return;
      }

      if (session) {
        // Resume existing session
        const updatedSession = { ...session, is_active: true, is_paused: false };
        setSession(updatedSession);
        await updateSessionInDB({ is_active: true, is_paused: false });
      } else {
        // Create new session
        const initialSeconds = workMinutes * 60;
        const { data, error } = await supabase
          .from('pomodoro_sessions')
          .insert({
            user_id: user.id,
            work_duration_minutes: workMinutes,
            break_duration_minutes: breakMinutes,
            total_cycles: totalCycles,
            current_cycle: 1,
            current_phase: 'work',
            time_remaining_seconds: initialSeconds,
            is_active: true,
            is_paused: false,
          })
          .select()
          .single();

        if (error) throw error;

        const sessionData: PomodoroSession = {
          ...data,
          current_phase: data.current_phase as 'work' | 'break'
        };
        setSession(sessionData);
        setTimeRemaining(initialSeconds);
      }
    } catch (error: any) {
      Alert.alert('Error', 'Failed to start timer');
    }
  };

  const pauseTimer = async () => {
    if (!session) return;

    const updatedSession = { ...session, is_paused: true };
    setSession(updatedSession);
    await updateSessionInDB({ is_paused: true });
  };

  const resetTimer = async () => {
    if (session) {
      await supabase.from('pomodoro_sessions').delete().eq('id', session.id);
    }
    
    setSession(null);
    setTimeRemaining(0);
    setWorkMinutes(25);
    setBreakMinutes(5);
    setTotalCycles(1);
    setWorkInput('25');
    setBreakInput('5');
  };

  const handlePhaseComplete = async () => {
    if (!session) return;

    if (session.current_phase === 'work') {
      // Switch to break
      const breakSeconds = breakMinutes * 60;
      const updatedSession = {
        ...session,
        current_phase: 'break' as const,
        time_remaining_seconds: breakSeconds,
      };
      setSession(updatedSession);
      setTimeRemaining(breakSeconds);
      await updateSessionInDB({
        current_phase: 'break',
        time_remaining_seconds: breakSeconds,
      });
      
      Alert.alert('Phase Complete', 'Work session complete! Time for a break.');
    } else {
      // Break complete
      if (session.current_cycle >= session.total_cycles) {
        // All cycles complete
        await resetTimer();
        Alert.alert('Session Complete', `Completed ${session.total_cycles} cycles!`);
      } else {
        // Start next cycle
        const workSeconds = workMinutes * 60;
        const updatedSession = {
          ...session,
          current_cycle: session.current_cycle + 1,
          current_phase: 'work' as const,
          time_remaining_seconds: workSeconds,
        };
        setSession(updatedSession);
        setTimeRemaining(workSeconds);
        await updateSessionInDB({
          current_cycle: session.current_cycle + 1,
          current_phase: 'work',
          time_remaining_seconds: workSeconds,
        });
        
        Alert.alert('Break Complete', `Starting cycle ${session.current_cycle + 1} of ${session.total_cycles}`);
      }
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const adjustCycles = (increment: boolean) => {
    if (session?.is_active) return;
    
    const newCycles = increment 
      ? totalCycles + 1 
      : Math.max(1, totalCycles - 1);
    setTotalCycles(newCycles);
  };

  const handleWorkTimeEdit = () => {
    if (session?.is_active) return;
    setEditingWork(true);
  };

  const handleBreakTimeEdit = () => {
    if (session?.is_active) return;
    setEditingBreak(true);
  };

  const saveWorkTime = () => {
    const minutes = parseInt(workInput);
    if (minutes > 0 && minutes <= 180) {
      setWorkMinutes(minutes);
    } else {
      setWorkInput(workMinutes.toString());
    }
    setEditingWork(false);
  };

  const saveBreakTime = () => {
    const minutes = parseInt(breakInput);
    if (minutes > 0 && minutes <= 60) {
      setBreakMinutes(minutes);
    } else {
      setBreakInput(breakMinutes.toString());
    }
    setEditingBreak(false);
  };

  const isActive = session?.is_active && !session.is_paused;
  const currentPhase = session?.current_phase || 'work';
  const showSingleTimer = session?.is_active;

  return (
    <View style={styles.container}>
      <Animated.View style={{ transform: [{ translateX: slideAnim }] }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Ionicons name="timer-outline" size={32} color="#60A5FA" />
            <Text style={styles.title}>Pomodoro Timer</Text>
          </View>
          <Text style={styles.subtitle}>Stay focused with the Pomodoro Technique</Text>
        </View>

        {/* Cycles Control */}
        <View style={styles.card}>
          <View style={styles.cyclesControl}>
            {!session?.is_active && (
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => adjustCycles(false)}
              >
                <Ionicons name="remove" size={20} color="#60A5FA" />
              </TouchableOpacity>
            )}
            <View style={styles.cycleCount}>
              <Text style={styles.cycleText}>
                {session?.is_active 
                  ? `Cycle ${session.current_cycle} of ${session.total_cycles}`
                  : `${totalCycles} cycle${totalCycles > 1 ? 's' : ''}`
                }
              </Text>
            </View>
            {!session?.is_active && (
              <TouchableOpacity
                style={styles.cycleButton}
                onPress={() => adjustCycles(true)}
              >
                <Ionicons name="add" size={20} color="#60A5FA" />
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* Timer Display */}
        <View style={styles.timerContainer}>
          {!showSingleTimer ? (
            <>
              {/* Work Timer */}
              <View style={styles.timerSection}>
                <TouchableOpacity
                  style={[styles.timerCircle, styles.workTimer]}
                  onPress={handleWorkTimeEdit}
                >
                  {editingWork ? (
                    <TextInput
                      value={workInput}
                      onChangeText={setWorkInput}
                      onBlur={saveWorkTime}
                      onSubmitEditing={saveWorkTime}
                      style={styles.timerInput}
                      keyboardType="number-pad"
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.timerText}>
                      {workMinutes}m
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.timerLabel}>Work</Text>
              </View>

              {/* Break Timer */}
              <View style={styles.timerSection}>
                <TouchableOpacity
                  style={[styles.timerCircle, styles.breakTimer]}
                  onPress={handleBreakTimeEdit}
                >
                  {editingBreak ? (
                    <TextInput
                      value={breakInput}
                      onChangeText={setBreakInput}
                      onBlur={saveBreakTime}
                      onSubmitEditing={saveBreakTime}
                      style={styles.timerInput}
                      keyboardType="number-pad"
                      autoFocus
                    />
                  ) : (
                    <Text style={styles.timerText}>
                      {breakMinutes}m
                    </Text>
                  )}
                </TouchableOpacity>
                <Text style={styles.timerLabel}>Break</Text>
              </View>
            </>
          ) : (
            /* Active Timer */
            <View style={styles.timerSection}>
              <View style={[
                styles.timerCircle,
                currentPhase === 'work' ? styles.workTimer : styles.breakTimer,
                styles.activeTimer
              ]}>
                <Text style={[
                  styles.timerText,
                  styles.activeTimerText
                ]}>
                  {formatTime(timeRemaining)}
                </Text>
              </View>
              <Text style={styles.timerLabel}>
                {currentPhase.charAt(0).toUpperCase() + currentPhase.slice(1)}
              </Text>
            </View>
          )}
        </View>

        {/* Control Buttons */}
        <View style={styles.controls}>
          {!session?.is_active ? (
            <TouchableOpacity
              style={styles.startButton}
              onPress={startTimer}
            >
              <Ionicons name="play" size={32} color="#fff" />
            </TouchableOpacity>
          ) : (
            <>
              <TouchableOpacity
                style={styles.controlButton}
                onPress={isActive ? pauseTimer : startTimer}
              >
                <Ionicons 
                  name={isActive ? "pause" : "play"} 
                  size={24} 
                  color="#60A5FA" 
                />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={styles.controlButton}
                onPress={resetTimer}
              >
                <Ionicons name="refresh" size={24} color="#60A5FA" />
              </TouchableOpacity>
              
              <TouchableOpacity
                style={[styles.controlButton, styles.deleteButton]}
                onPress={resetTimer}
              >
                <Ionicons name="trash" size={24} color="#EF4444" />
              </TouchableOpacity>
            </>
          )}
        </View>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A1E1C',
    padding: 16,
  },
  header: {
    alignItems: 'center',
    marginTop: 3,
    marginBottom: 20,
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#60A5FA',
    marginLeft: 8,
  },
  subtitle: {
    color: '#9CA3AF',
    textAlign: 'center',
  },
  card: {
    backgroundColor: 'rgba(14, 46, 44, 0.85)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cyclesControl: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cycleCount: {
    backgroundColor: 'rgba(96, 165, 250, 0.1)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    marginHorizontal: 12,
  },
  cycleText: {
    color: '#60A5FA',
    fontWeight: '500',
  },
  timerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  timerSection: {
    alignItems: 'center',
    marginHorizontal: 16,
  },
  timerCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  workTimer: {
    borderColor: '#EF4444',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  breakTimer: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  activeTimer: {
    width: 128,
    height: 128,
    borderRadius: 64,
    borderWidth: 8,
  },
  timerText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#E5E7EB',
  },
  activeTimerText: {
    fontSize: 24,
  },
  timerLabel: {
    color: '#9CA3AF',
    marginTop: 8,
  },
  timerInput: {
    fontSize: 18,
    color: '#E5E7EB',
    textAlign: 'center',
    width: 48,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  startButton: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#60A5FA',
    justifyContent: 'center',
    alignItems: 'center',
  },
  controlButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: '#60A5FA',
    backgroundColor: 'transparent',
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteButton: {
    borderColor: '#EF4444',
  },
});