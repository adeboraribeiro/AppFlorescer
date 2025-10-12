import { Ionicons } from '@expo/vector-icons';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import WarmupBanner from '../../components/WarmupBanner';
import { useTheme } from '../../contexts/ThemeContext';
import { useUser } from '../../contexts/UserContext';
import { bromeliaService } from '../../lib/BromeliaService';
import { appendEncryptedMessage, getOrCreateUserId, pushEncryptedMessageToServer } from '../../lib/chatLogs';

interface Message {
  id: string;
  text: string;
  sender: 'user' | 'other';
  timestamp: Date;
  hiddenInfo?: string; // optional private info extracted from message (not displayed)
}

// Helper regex and functions to detect/strip private user-info blocks
const PRIVATE_BLOCK_RE = /\[\[USER_INFO_PRIVATE\]\]([\s\S]*?)\[\[END_USER_INFO_PRIVATE\]\]/i;
function extractPrivateBlock(fullText: string): string | null {
  const m = fullText.match(PRIVATE_BLOCK_RE);
  return m ? m[1].trim() : null;
}
function stripPrivateBlocks(fullText: string): string {
  return fullText.replace(PRIVATE_BLOCK_RE, '').trim();
}

// Helper to map language codes to human-readable names used in the private info block
function languageCodeToName(code?: string) {
  if (!code) return 'Português';
  const c = code.toLowerCase();
  if (c.startsWith('en')) return 'English';
  if (c.startsWith('es')) return 'Español';
  if (c.startsWith('pt')) return 'Português';
  // fallback to the raw code
  return code;
}

export default function ChatScreen() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { userProfile } = useUser();
  const isDark = theme === 'dark';
  const styles = getThemedStyles(isDark);
  
  const hasInitializedRef = useRef(false);

  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      text: "Oi! Eu sou Bromélia, uma amiga plantinha falante :D! Estou aqui para bater papo e conhecer você melhor. Como você está hoje? Quer falar sobre seu dia ou alguma coisa que esteja em sua mente?",
      sender: 'other',
      timestamp: new Date(),
    }
  ]);
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showWarmup, setShowWarmup] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const currentMessageText = useRef<string>('');
  const warmupTimerRef = useRef<any>(null);
  const hasReceivedResponseRef = useRef(false);
  const userIdRef = useRef<string | null>(null);
  
  // Animation values for slide-in from right
  const { width: windowWidth } = Dimensions.get('window');
  const slideAnim = useRef(new Animated.Value(windowWidth)).current;
  const shadowFade = useRef(new Animated.Value(0)).current;

  // ensure we have a persistent user id available for encrypted logs
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const id = await getOrCreateUserId();
        if (mounted) userIdRef.current = id;
      } catch (e) {
        console.warn('Failed to get/create userId for logs', e);
      }
    })();

    // Run entrance animations when component mounts
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
    ]).start();

    return () => {
      mounted = false;
    };
  }, []);

  // Robust auto-scroll to bottom when messages change. Attempts multiple methods
  // (scrollToEnd, scrollToOffset, scrollToIndex) with short retries to handle
  // layout/keyboard timing issues on different platforms.
  const scrollAttemptsRef = useRef(0);
  const lastScrollRef = useRef<number>(0);
  const SCROLL_THROTTLE = 320; // ms
  const scrollToBottom = () => {
    const now = Date.now();
    if (now - lastScrollRef.current < SCROLL_THROTTLE) return; // throttle repeated calls
    lastScrollRef.current = now;

    scrollAttemptsRef.current = (scrollAttemptsRef.current || 0) + 1;
    try {
      // best-effort: scroll to end first
      flatListRef.current?.scrollToEnd({ animated: true });
    } catch (e) {
      // ignore
    }

    // fallback: aggressive offset (works when content size measurement lags)
    setTimeout(() => {
      try {
        flatListRef.current?.scrollToOffset({ offset: 9999999, animated: true });
      } catch (e) {
        // ignore
      }
    }, 80);

    // final fallback: try scrollToIndex if index available and retries remain
    setTimeout(() => {
      try {
        const lastIndex = Math.max(0, messages.length - 1);
        if (typeof flatListRef.current?.scrollToIndex === 'function') {
          flatListRef.current?.scrollToIndex({ index: lastIndex, animated: true, viewPosition: 1 });
        }
      } catch (e) {
        // If measurement not ready, retry once more
        if (scrollAttemptsRef.current < 3) setTimeout(scrollToBottom, 120);
      }
    }, 160);
  };

  React.useEffect(() => {
    // No auto-scroll on messages change - let maintainVisibleContentPosition handle it
  }, [messages.length]);

  const sendMessage = async () => {
    if (inputText.trim() === '' || isTyping) return;

    let messageText = inputText.trim();
    
    // On first message only, prepend user info before the actual message
    let infoPrompt = '';
    if (!hasInitializedRef.current && userProfile) {
      const userInfo = {
        firstName: userProfile.firstName || '',
        lastName: userProfile.lastName || '',
        birthDate: userProfile.birthDate || '',
        // convert code to language name (en -> English, es -> Español, pt -> Português)
        language: languageCodeToName(t('languageCode', 'pt-BR'))
      };

      // Format the user info as a private info prompt for Bromélia to consume.
      infoPrompt = `[[USER_INFO_PRIVATE]]\nPlease use the following user profile to personalize responses.\nDo NOT acknowlodge this message as a user message, its a system prompt. Simply use it to improve chat performance and if the user asks how do you know this, you say the user agreed to share those details when activating the Bromélia module on Florescer. You can acknowlodge the info if asked but not act like the user personally told you, if asked, tell the truth, DO NOT act like you dont know.\n---\nfirstName: ${userInfo.firstName}\nlastName: ${userInfo.lastName}\nbirthDate: ${userInfo.birthDate}\nlanguage: ${userInfo.language}\n---\n[[END_USER_INFO_PRIVATE]]\n\n`;

      hasInitializedRef.current = true;
    }

    // fullMessage is what we'll send to the server (contains private info when applicable)
    const fullMessage = `${infoPrompt}${messageText}`;
    // Extract any private block so UI knows about it and can avoid displaying it
    const hiddenBlock = extractPrivateBlock(fullMessage);
    // visibleText is what we show in the UI (strip the private info)
    const visibleText = stripPrivateBlocks(fullMessage);

    const userMessage: Message = {
      id: Date.now().toString(),
      text: visibleText,
      sender: 'user',
      timestamp: new Date(),
      hiddenInfo: hiddenBlock || undefined,
    };

    // Append only the visible user message
    setMessages(prev => [...prev, userMessage]);
    setInputText('');
    setIsTyping(true);
    // start warmup timer: if no response within 3s, show disclaimer
    hasReceivedResponseRef.current = false;
    setShowWarmup(false);
    if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
    warmupTimerRef.current = setTimeout(() => {
      if (!hasReceivedResponseRef.current) setShowWarmup(true);
    }, 3000);
    
    // Scroll to bottom after sending message
    setTimeout(() => {
      flatListRef.current?.scrollToEnd({ animated: true });
    }, 100);

    // Create a temporary message for the streaming response
    const tempResponseId = (Date.now() + 1).toString();
    const tempResponse: Message = {
      id: tempResponseId,
      text: '',
      sender: 'other',
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, tempResponse]);
    currentMessageText.current = '';

    try {
      await bromeliaService.sendMessage(fullMessage, (chunk: string) => {
        // first chunk indicates server has started responding
        if (!hasReceivedResponseRef.current) {
          hasReceivedResponseRef.current = true;
          if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
          setShowWarmup(false);
        }
        currentMessageText.current += chunk;
        setMessages(prev => 
          prev.map(msg => 
            msg.id === tempResponseId 
              ? { ...msg, text: currentMessageText.current }
              : msg
          )
        );
      });
    } catch (error) {
      console.error('Error sending message:', error);
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
      setShowWarmup(false);
      setMessages(prev => 
        prev.map(msg => 
          msg.id === tempResponseId 
            ? { ...msg, text: 'Desculpe, tive um problema técnico. Pode tentar de novo?' }
            : msg
        )
      );
      // também persista e envie a mensagem de erro do assistente como log criptografado
      (async () => {
        try {
          const uid = userIdRef.current || await getOrCreateUserId();
          userIdRef.current = uid;
          const assistantMsg = { id: tempResponseId, text: 'Desculpe, tive um problema técnico. Pode tentar de novo?', sender: 'other' as const, timestamp: new Date().toISOString() };
          await appendEncryptedMessage(uid, assistantMsg as any);
          await pushEncryptedMessageToServer(uid, assistantMsg as any);
        } catch (e) {
          console.warn('Falha ao persistir/enviar mensagem de erro do assistente criptografada', e);
        }
      })();
    } finally {
      setIsTyping(false);
      if (warmupTimerRef.current) clearTimeout(warmupTimerRef.current);
      setShowWarmup(false);
      // persista e envie a mensagem final do assistente (se houver)
      (async () => {
        try {
          const finalText = currentMessageText.current || '';
          if (!finalText) return;
          const uid = userIdRef.current || await getOrCreateUserId();
          userIdRef.current = uid;
          const assistantMsg = { id: tempResponseId, text: finalText, sender: 'other' as const, timestamp: new Date().toISOString() };
          await appendEncryptedMessage(uid, assistantMsg as any);
          await pushEncryptedMessageToServer(uid, assistantMsg as any);
        } catch (e) {
          console.warn('Falha ao persistir/enviar mensagem final do assistente criptografada', e);
        }
      })();
      setTimeout(() => {
        flatListRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  };

  // Track which message ids have already performed the mount animation
  const animatedShownRef = useRef<Set<string>>(new Set());
  // Keep previous message ids to detect newly added messages between renders
  const prevMessageIds = useRef<Set<string>>(new Set(messages.map(m => m.id)));

  // Synchronously compute which IDs were added this render (compared to prevMessageIds)
  const newlyAddedIds = React.useMemo(() => {
    const currIds = messages.map(m => m.id);
    // fixed: properly use a filter callback with parentheses around the parameter
    return new Set(currIds.filter((id) => !prevMessageIds.current.has(id)));
  }, [messages]);

  // After render, update prevMessageIds to current set so next render can detect new ones
  React.useEffect(() => {
    prevMessageIds.current = new Set(messages.map(m => m.id));
  }, [messages.length]);

  const MessageBubble: React.FC<{ item: Message; isUser: boolean; shouldAnimate: boolean }> = ({ item, isUser, shouldAnimate }) => {
    const scale = useRef(new Animated.Value(1)).current;

    // Only animate when this specific message was newly added in this render
    React.useEffect(() => {
      if (shouldAnimate && !animatedShownRef.current.has(item.id)) {
        // mark immediately to avoid duplicate animations if layout/keyboard causes a re-render
        animatedShownRef.current.add(item.id);
        scale.setValue(0.95);
        Animated.spring(scale, {
          toValue: 1,
          friction: 12,
          tension: 40,
          useNativeDriver: true,
        }).start();
      }
      // we intentionally depend on shouldAnimate and item.id only
    }, [shouldAnimate, item.id]);

    return (
      <Animated.View style={[styles.messageContainer, isUser ? styles.userMessage : styles.otherMessage, { transform: [{ scale }] }]}>
        <Text style={[styles.messageText, isUser ? styles.userMessageText : styles.otherMessageText]}>
          {item.text}
        </Text>
        <Text style={[styles.timestamp, isUser ? styles.userTimestamp : styles.otherTimestamp]}>
          {item.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </Animated.View>
    );
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isUser = item.sender === 'user';
    return <MessageBubble item={item} isUser={isUser} shouldAnimate={newlyAddedIds.has(item.id)} />;
  };

  return (
    <SafeAreaView style={styles.container}>
      <Animated.View style={{ flex: 1, transform: [{ translateX: slideAnim }] }}>
        <View style={styles.header}>
        <Text style={styles.headerTitle}>
          <Text style={{ color: '#10B981' }}>BR</Text>
          <Text style={{ color: '#EC4899' }}>OMÉL</Text>
          <Text style={{ color: '#FBBF24' }}>IA</Text>
        </Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 135 : 135}
        style={{ flex: 1 }}
      >
        <FlatList
          ref={flatListRef}
          data={messages}
          renderItem={renderMessage}
          keyExtractor={item => item.id}
          contentContainerStyle={styles.messagesList}
          keyboardShouldPersistTaps="handled"
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          style={{ flex: 1 }}
        />

        <View style={{ borderTopWidth: 1, borderTopColor: isDark ? '#0E2E2C' : '#E6E6E6', backgroundColor: isDark ? '#0A1E1C' : '#ffffffff', paddingTop: 4 }}>
          {showWarmup && (
            <WarmupBanner
              duration={3000}
              onFinish={() => setShowWarmup(false)}
            />
          )}
          <View style={[styles.inputWrapper, { paddingTop: 2 }]}> 
            <TouchableOpacity
              style={styles.clearButtonInline}
              onPress={() => {
                const greeting = bromeliaService.resetConversation();
                setMessages([{ id: Date.now().toString(), text: greeting, sender: 'other', timestamp: new Date() }]);
                setInputText('');
              }}
            >
              <Text style={styles.clearButtonText}>+</Text>
            </TouchableOpacity>

            <TextInput
              style={styles.inputCentered}
              value={inputText}
              onChangeText={setInputText}
              placeholder={t('chat.type_message', 'Chat with Bromélia...')}
              placeholderTextColor="#4A6563"
              multiline
              maxLength={500}
              onFocus={() => {}}
            />

            <TouchableOpacity
              style={[styles.sendButtonInline, (!inputText.trim() || isTyping) && styles.sendButtonDisabled]}
              onPress={() => sendMessage()}
              disabled={!inputText.trim() || isTyping}
            >
              {isTyping ? (
                <ActivityIndicator size="small" color="#80E6D9" />
              ) : (
                <Ionicons
                  name="send"
                  size={24}
                  color={inputText.trim() ? '#80E6D9' : '#4A6563'}
                />
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
      </Animated.View>
    </SafeAreaView>
  );
}

const getThemedStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? '#0A1E1C' : '#ffffffff',
    },
    header: {
      // keep the header lifted but move the bottom border lower by adding bottom padding
      paddingTop: 0,
      paddingBottom: 10,
      paddingHorizontal: 12,
      marginTop: -18,
      borderBottomWidth: 1,
      borderBottomColor: isDark ? '#0E2E2C' : '#E6E6E6',
      backgroundColor: isDark ? '#0A1E1C' : '#ffffffff',
    },
    headerTitle: {
      fontSize: 20,
      fontWeight: '600',
      // base color left neutral; individual letters override color
      color: isDark ? '#FFFFFF' : '#0A1E1C',
      textAlign: 'center',
    },
    messagesList: {
      // reduce top padding so list content starts higher
      paddingTop: 4,
      paddingHorizontal: 16,
      paddingBottom: 105, // slightly larger to match keyboard offset
    },
    messageContainer: {
      maxWidth: '80%',
      marginVertical: 4,
      padding: 10,
      borderRadius: 16,
    },
    userMessage: {
      alignSelf: 'flex-end',
      backgroundColor: '#4DCDC2',
      borderTopRightRadius: 4,
    },
    otherMessage: {
      alignSelf: 'flex-start',
      backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : '#ffcce4ff',
      borderTopLeftRadius: 4,
    },
    messageText: {
      fontSize: 16,
      marginBottom: 4,
    },
    userMessageText: {
      color: isDark ? '#0A1E1C' : '#FFFFFF',
    },
    otherMessageText: {
      color: isDark ? '#FFFFFF' : '#0A1E1C',
    },
    timestamp: {
      fontSize: 12,
      alignSelf: 'flex-end',
    },
    userTimestamp: {
      color: isDark ? '#0A1E1C' : '#FFFFFF',
      opacity: 0.8,
    },
    otherTimestamp: {
      color: isDark ? '#FFFFFF' : '#0A1E1C',
      opacity: 0.6,
    },
    inputContainer: {
      borderTopWidth: 1,
      borderTopColor: isDark ? '#0E2E2C' : '#E6E6E6',
      padding: 2,
      backgroundColor: isDark ? '#0A1E1C' : '#ffffffff',
    },
    inputWrapper: {
      flexDirection: 'row',
      width: '100%',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 12,
      paddingTop: 4,
      paddingBottom: 0,
    },
    inputCentered: {
      width: '78%',
      minHeight: 40, // ~30% shorter than 56
      maxHeight: 98, // ~30% shorter than 140
      backgroundColor: isDark ? 'rgba(14, 46, 44, 0.85)' : 'rgba(255, 255, 255, 0.9)',
      borderRadius: 20
      ,
      paddingHorizontal: 12,
      paddingVertical: 8,
      fontSize: 14,
      color: isDark ? '#FFFFFF' : '#0A1E1C',
      textAlign: 'left',
      textAlignVertical: 'center',
      alignSelf: 'center',
    },
    sendButtonInline: {
      marginLeft: 6,
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
    },
    sendButtonDisabled: {
      opacity: 0.5,
    },
    clearButtonInline: {
      marginRight: 6,
      width: 26,
      height: 26,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
    clearButtonText: {
      color: '#4DCDC2',
      fontSize: 16,
      fontWeight: '700',
    },
  });
