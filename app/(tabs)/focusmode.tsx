import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

export default function FocusMode() {
	const { theme } = useTheme();
	const isDark = theme === 'dark';
	return (
		<SafeAreaView style={[styles.container, { backgroundColor: isDark ? '#071615' : '#fff' }]}>
			<View style={styles.center}>
				<Text style={[styles.title, { color: isDark ? '#fff' : '#0A1E1C' }]}>Welcome to Focus Mode</Text>
				<Text style={[styles.subtitle, { color: isDark ? '#cfeee8' : '#4A6563' }]}>A minimal placeholder screen for the Focus Mode module.</Text>
			</View>
		</SafeAreaView>
	);
}

const styles = StyleSheet.create({
	container: { flex: 1 },
	center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
	title: { fontSize: 22, fontWeight: '700', marginBottom: 8 },
	subtitle: { fontSize: 14, textAlign: 'center' }
});

