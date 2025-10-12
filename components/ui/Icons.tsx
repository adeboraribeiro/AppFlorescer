import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleProp, TextStyle } from 'react-native';

type IconProps = {
  size?: number;
  color?: string;
  style?: StyleProp<TextStyle>;
};

// Export specific icons that you use
export const Icons = {
  settings: (props: IconProps) => <Ionicons name="settings-outline" {...props} />,
  home: (props: IconProps) => <Ionicons name="home-outline" {...props} />,
  chat: (props: IconProps) => <Ionicons name="chatbubble-outline" {...props} />,
  timer: (props: IconProps) => <Ionicons name="timer-outline" {...props} />,
  person: (props: IconProps) => <Ionicons name="person-circle-outline" {...props} />,
  close: (props: IconProps) => <Ionicons name="close" {...props} />,
  logout: (props: IconProps) => <Ionicons name="log-out-outline" {...props} />,
  chevronRight: (props: IconProps) => <Ionicons name="chevron-forward" {...props} />,
  language: (props: IconProps) => <Ionicons name="language-outline" {...props} />,
  flower: (props: IconProps) => <Ionicons name="flower-outline" {...props} />
  ,
  bell: (props: IconProps) => <Ionicons name="notifications-outline" {...props} />
} as const;

// For TypeScript
export type IconName = keyof typeof Icons;
