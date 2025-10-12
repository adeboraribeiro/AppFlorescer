import { BlurView } from 'expo-blur';
import React, { useEffect, useRef } from 'react';
import { Animated, Dimensions, GestureResponderEvent, Keyboard, Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useTheme } from '../contexts/ThemeContext';

type Props = {
	onClose?: () => void;
	onSubmit?: (code: string) => void;
	onValidate?: (code: string) => void;
};

// ===========================
// SIMPLE OTP NODE (embedded)
// ===========================
type Shape = 'rounded' | 'rect' | 'circle';

interface OTPNodeProps {
	size?: number;
	hPad?: number;
	filled?: boolean;
	digit?: string;
	showDigit?: boolean;
	shape?: Shape;
	bgColor?: string;
	borderColor?: string;
	accentColor?: string;
	onPress?: (e: GestureResponderEvent) => void;
	style?: any;
}

// Defaults tuned to app palette
const DEFAULT_SIZE = 52;
const DEFAULT_H_PAD = 8;
const DEFAULT_SHAPE: Shape = 'rounded';
// Use same accent + translucent fills as account.tsx
const DEFAULT_BG_COLOR = 'rgba(77,204,193,0.06)';
const DEFAULT_BORDER_COLOR = 'rgba(77,204,193,0.22)';
const DEFAULT_ACCENT_COLOR = '#4DCDC2';

const MIN_DOT_WIDTH = 8;
const MIN_DOT_HEIGHT = 10;
const MIN_CONTAINER_HEIGHT = 32;
const MIN_FONT_SIZE = 14;

const DOT_WIDTH_RATIO = 0.82;
const DOT_HEIGHT_RATIO = 0.62;
const CONTAINER_HEIGHT_RATIO = 1.18;
const FONT_SIZE_RATIO = 0.42;

const BORDER_RADIUS = {
	rect: 6,
	rounded: 10,
} as const;

const calculateDotDimensions = (size: number, hPad: number) => {
	const width = Math.max(MIN_DOT_WIDTH, Math.round((size - hPad * 2) * DOT_WIDTH_RATIO));
	const height = Math.max(MIN_DOT_HEIGHT, Math.round(size * DOT_HEIGHT_RATIO));
	return { width, height };
};

const calculateBorderRadius = (shape: Shape, size: number): number => {
	switch (shape) {
		case 'rect':
			return BORDER_RADIUS.rect;
		case 'circle':
			return Math.round(size / 2);
		case 'rounded':
		default:
			return BORDER_RADIUS.rounded;
	}
};

const calculateContainerHeight = (size: number) => Math.max(MIN_CONTAINER_HEIGHT, Math.round(size * CONTAINER_HEIGHT_RATIO));
const calculateFontSize = (size: number) => Math.max(MIN_FONT_SIZE, Math.round(size * FONT_SIZE_RATIO));

const DotIndicator: React.FC<{ width: number; height: number; accentColor: string }> = ({ width, height, accentColor }) => (
	<View style={{ width, height, borderRadius: Math.round(height / 2), backgroundColor: accentColor }} />
);

const DigitDisplay: React.FC<{ digit: string; accentColor: string; fontSize: number }> = ({ digit, accentColor, fontSize }) => (
	<Text style={[localStyles.digit, { color: accentColor, fontSize }]}>{digit}</Text>
);

const NodeContent: React.FC<any> = ({ filled, showDigit, digit, accentColor, dotDimensions, fontSize }) => {
	if (!filled) return null;
	return (
		<View style={localStyles.inner} pointerEvents="none">
			{showDigit ? (
				<DigitDisplay digit={digit} accentColor={accentColor} fontSize={fontSize} />
			) : (
				<DotIndicator width={dotDimensions.width} height={dotDimensions.height} accentColor={accentColor} />
			)}
		</View>
	);
};

const OTPNodeSimple: React.FC<OTPNodeProps> = ({
	size = DEFAULT_SIZE,
	hPad = DEFAULT_H_PAD,
	filled = false,
	digit = '',
	showDigit = false,
	shape = DEFAULT_SHAPE,
	bgColor = DEFAULT_BG_COLOR,
	borderColor = DEFAULT_BORDER_COLOR,
	accentColor = DEFAULT_ACCENT_COLOR,
	onPress,
	style,
}) => {
	const dotDimensions = calculateDotDimensions(size, hPad);
	const borderRadius = calculateBorderRadius(shape, size);
	const containerHeight = calculateContainerHeight(size);
	const fontSize = calculateFontSize(size);

	const containerStyle = [
		localStyles.container,
		{
			width: size,
			height: containerHeight,
			borderRadius,
			backgroundColor: bgColor,
			borderColor,
		},
		style,
	];

	return (
		<TouchableOpacity activeOpacity={0.85} onPress={onPress} style={containerStyle}>
			<NodeContent filled={filled} showDigit={showDigit} digit={digit} accentColor={accentColor} dotDimensions={dotDimensions} fontSize={fontSize} />
		</TouchableOpacity>
	);
};


function OTPpopup(props: Props) {
	const { theme } = useTheme();
	const isDark = theme === 'dark';
	const WINDOW = Dimensions.get('window');

	// animated shift for keyboard (so modal raises smoothly)
	const animatedShift = useRef(new Animated.Value(0)).current;

	useEffect(() => {
		const eventShow = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
		const eventHide = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';

		// Smaller fraction and cap so the modal only nudges up slightly.
		const onShow = (e: any) => {
			const h = e?.endCoordinates?.height ?? 300;
			// use a small positive target; transform will invert it so positive => move up
			// increase movement: 20% of keyboard height, capped at 16% of window height
			const target = Math.min(h * 0.21, WINDOW.height * 0.17);
			Animated.spring(animatedShift, { toValue: target, tension: 40, friction: 9, useNativeDriver: true }).start();
		};

		const onHide = () => {
			Animated.spring(animatedShift, { toValue: 0, tension: 40, friction: 9, useNativeDriver: true }).start();
		};

		const showSub = Keyboard.addListener(eventShow, onShow);
		const hideSub = Keyboard.addListener(eventHide, onHide);

		return () => {
			showSub.remove();
			hideSub.remove();
		};
	}, [animatedShift]);
	const count = 6;
	const [values, setValues] = React.useState<string[]>(Array(count).fill(''));
	const inputsRef = React.useRef<Array<TextInput | null>>([]);

	React.useEffect(() => {
		// focus first input shortly after mount
		const t = setTimeout(() => inputsRef.current[0]?.focus(), 80);
		return () => clearTimeout(t);
	}, []);

	const focusAt = (idx: number) => {
		const ref = inputsRef.current[idx];
		if (ref) ref.focus();
	};

	const handleChange = (text: string, idx: number) => {
		const digitsOnly = text.replace(/\D/g, '');
		// Paste handling: if user pasted multiple digits, fill forwards
		if (digitsOnly.length > 1) {
			const next = [...values];
			for (let i = 0; i < digitsOnly.length && idx + i < count; i++) {
				next[idx + i] = digitsOnly[i];
			}
			setValues(next);
			const lastFilled = Math.min(count - 1, idx + digitsOnly.length - 1);
			if (lastFilled + 1 < count) focusAt(lastFilled + 1);
			if (next.every(v => v !== '')) {
				Keyboard.dismiss();
				props.onSubmit?.(next.join(''));
			}
			return;
		}

		const char = digitsOnly.slice(-1);
		const next = [...values];
		next[idx] = char;
		setValues(next);

		if (char) {
			if (idx + 1 < count) focusAt(idx + 1);
		}

		if (next.every(v => v !== '')) {
			Keyboard.dismiss();
			props.onSubmit?.(next.join(''));
		}
	};

	const handleKeyPress = (e: any, idx: number) => {
		if (e.nativeEvent.key === 'Backspace') {
			if (values[idx]) {
				const next = [...values];
				next[idx] = '';
				setValues(next);
			} else if (idx > 0) {
				const prev = idx - 1;
				const next = [...values];
				next[prev] = '';
				setValues(next);
				focusAt(prev);
			}
		}
	};

	const nodes = Array.from({ length: count }).map((_, i) => (
			<TextInput
				key={i}
				ref={(ref) => { inputsRef.current[i] = ref; }}
							value={values[i]}
							onChangeText={text => handleChange(text, i)}
							onKeyPress={e => handleKeyPress(e, i)}
							keyboardType={Platform.OS === 'ios' ? 'number-pad' : 'numeric'}
							returnKeyType={i === count - 1 ? 'done' : 'next'}
							maxLength={1}
							style={[localStyles.inputNode, { borderColor: '#4DCDC2', backgroundColor: 'rgba(77,204,193,0.06)', color: isDark ? '#E5E7EB' : '#0A1E1C' }]}
							textAlign="center"
							placeholder=""
							placeholderTextColor={Platform.OS === 'ios' ? 'rgba(0,0,0,0.25)' : 'rgba(255,255,255,0.25)'}
							autoCapitalize="none"
							autoCorrect={false}
							selectTextOnFocus
						/>
	));

	const isValidateDisabled = values.some(v => v === '');

	return (
		<BlurView intensity={1200} tint={isDark ? 'dark' : 'dark'} style={styles.backdrop}>
			<Animated.View style={[
				styles.card,
				{ backgroundColor: isDark ? '#0A1E1C' : '#F7FFFC', borderColor: '#4DCDC2', transform: [{ translateY: Animated.multiply(animatedShift, -1) }] }
			]}>
				<Text style={localStyles.title}>Insert OTP</Text>
				<View style={{ height: 10 }} />
				<View style={localStyles.row}>{nodes}</View>
				<View style={{ height: 14 }} />
				<View style={localStyles.actionsRow}>
					<TouchableOpacity onPress={() => props.onClose?.()} style={[localStyles.btn, localStyles.btnSecondary, { borderColor: '#4DCDC2', backgroundColor: 'rgba(77,204,193,0.06)' }]} activeOpacity={0.85}>
						<Text style={[localStyles.btnText, { color: '#4DCDC2' }]}>Cancel</Text>
					</TouchableOpacity>
					<TouchableOpacity onPress={() => props.onValidate?.(values.join(''))} disabled={isValidateDisabled} accessibilityState={{ disabled: isValidateDisabled }} style={[localStyles.btn, localStyles.btnPrimary, { borderColor: isValidateDisabled ? '#9CCFC8' : '#4DCDC2', backgroundColor: isValidateDisabled ? 'rgba(77,204,193,0.03)' : 'rgba(77,204,193,0.06)', opacity: isValidateDisabled ? 0.75 : 1 }]} activeOpacity={0.85}>
						<Text style={[localStyles.btnText, { color: isValidateDisabled ? '#9CCFC8' : '#4DCDC2' }]}>{'Validate'}</Text>
					</TouchableOpacity>
				</View>
			</Animated.View>
		</BlurView>
	);
}

const styles = StyleSheet.create({
	backdrop: {
		position: 'absolute',
		top: 0,
		left: 0,
		right: 0,
		bottom: 0,
		backgroundColor: 'rgba(0,0,0,0.5)',
		justifyContent: 'center',
		alignItems: 'center',
		padding: 20,
		zIndex: 9999,
	},
		card: {
		width: '100%',
		maxWidth: 420,
		height: 180,
		backgroundColor: '#0A1E1C',
			borderColor: '#4DCDC2',
		borderWidth: 0.7,
		borderRadius: 12,
		alignItems: 'center',
		justifyContent: 'center',
		shadowColor: '#000',
		shadowOffset: { width: 0, height: 4 },
		shadowOpacity: 0.2,
		shadowRadius: 6,
	},
});

// Export both default and named for easy import anywhere
export default OTPpopup;
export { OTPpopup };

const localStyles = StyleSheet.create({
	container: {
		alignItems: 'center',
		justifyContent: 'center',
		borderWidth: 1,
		paddingHorizontal: 6,
	},
	inner: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	digit: {
		fontWeight: '700',
	},
	row: {
		flexDirection: 'row',
		alignItems: 'center',
		justifyContent: 'center',
	},
		inputNode: {
			width: 48,
			height: 56,
			marginHorizontal: 6,
			borderRadius: 10,
			borderWidth: 1,
			borderColor: 'rgba(77,205,193,0.22)',
			backgroundColor: 'rgba(77,205,193,0.06)',
			color: '#E5E7EB',
			fontSize: 20,
			fontWeight: '700',
		},

		title: {
			color: '#4DCDC2',
			fontSize: 18,
			fontWeight: '700',
			textAlign: 'center',
		},

		actionsRow: {
			flexDirection: 'row',
			width: '100%',
			justifyContent: 'space-between',
			paddingHorizontal: 20,
		},

		btn: {
			paddingVertical: 8,
			paddingHorizontal: 18,
			borderRadius: 10,
			minWidth: 100,
			alignItems: 'center',
			justifyContent: 'center',
		},

			// Both buttons use the same transparent background but with a visible outline
			btnPrimary: {
				backgroundColor: 'transparent',
				borderWidth: 0.7,
				borderColor: '#4DCDC2',
			},

			btnSecondary: {
				backgroundColor: 'transparent',
				borderWidth: 0.7,
				borderColor: '#4DCDC2',
			},

			btnText: {
				color: '#4DCDC2',
				fontWeight: '700',
			},
});
