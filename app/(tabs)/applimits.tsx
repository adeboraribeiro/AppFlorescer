import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, Easing, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export default function AppLimits() {
	const { theme } = useTheme();
	const isDark = theme === 'dark';
	const [isNavigating, setIsNavigating] = React.useState(false);
	
	// Animation values for slide-in from right
	const { width: windowWidth } = Dimensions.get('window');
	const slideAnim = useRef(new Animated.Value(windowWidth)).current;
	const shadowFade = useRef(new Animated.Value(0)).current;

	// Run entrance animations when component mounts
	useEffect(() => {
		setIsNavigating(true);
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

	return (
		<SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#071615' : '#fff' }]}>
			<Animated.View style={[styles.container, { transform: [{ translateX: slideAnim }] }]}>
				<View style={styles.center}>
					<Text style={[styles.title, { color: isDark ? '#fff' : '#0A1E1C' }]}>Welcome to App Limits</Text>
					<Text style={[styles.subtitle, { color: isDark ? '#cfeee8' : '#4A6563' }]}>A minimal placeholder screen for the App Limits module.</Text>
				</View>
			</Animated.View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
	title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
	subtitle: { fontSize: 14, textAlign: 'center' }
});

