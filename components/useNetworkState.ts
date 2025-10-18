import { useEffect, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';

export default function useNetworkState() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);

  useEffect(() => {
    const unsubNet = NetInfo.addEventListener((state: any) => {
      try {
        setIsConnected(!!state.isConnected);
        setIsInternetReachable(state.isInternetReachable ?? null);
      } catch (e) { /* ignore */ }
    });

    NetInfo.fetch().then((s: any) => {
      try {
        setIsConnected(!!s.isConnected);
        setIsInternetReachable(s.isInternetReachable ?? null);
      } catch (e) { /* ignore */ }
    }).catch(() => {});

    return () => {
      try { unsubNet(); } catch (e) { /* ignore */ }
    };
  }, []);

  const deviceOffline = isConnected === false;
  const internetUnreachable = isInternetReachable === false;

  const isOffline = deviceOffline || internetUnreachable;
  const source = deviceOffline ? 'device' : (internetUnreachable ? 'internet' : 'ok');

  return { isConnected, isInternetReachable, isOffline, source };
}
