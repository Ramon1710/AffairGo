import { Image, Platform, StyleSheet, Text, View } from 'react-native';
import { affairGoTheme } from '../constants/affairGoTheme';

const nightWhisperSymbol = require('../assets/branding/night-whisper-symbol.png');

const SYMBOL_ASPECT_RATIO = 545 / 654;

const NightWhisperLogo = ({
  variant = 'full',
  height,
  style,
  symbolStyle,
  wordmarkStyle,
}) => {
  const resolvedHeight = height || (variant === 'icon' ? 34 : (Platform.OS === 'web' ? 42 : 34));
  const symbolWidth = Math.round(resolvedHeight * SYMBOL_ASPECT_RATIO);
  const fontSize = Math.max(18, Math.round(resolvedHeight * 0.74));
  const lineHeight = Math.round(fontSize * 1.04);
  const wordGap = Math.max(6, Math.round(resolvedHeight * 0.14));

  if (variant === 'icon') {
    return (
      <View style={[styles.root, { minHeight: resolvedHeight }, style]}>
        <Image
          accessibilityIgnoresInvertColors
          source={nightWhisperSymbol}
          resizeMode="contain"
          style={[styles.symbol, { width: symbolWidth, height: resolvedHeight }, symbolStyle]}
        />
      </View>
    );
  }

  return (
    <View style={[styles.root, styles.fullRoot, { minHeight: resolvedHeight }, style]}>
      <Image
        accessibilityIgnoresInvertColors
        source={nightWhisperSymbol}
        resizeMode="contain"
        style={[styles.symbol, { width: symbolWidth, height: resolvedHeight }, symbolStyle]}
      />
      <View style={[styles.wordmarkRow, { marginLeft: wordGap }]}>
        <Text
          numberOfLines={1}
          style={[
            styles.wordmark,
            styles.night,
            {
              fontSize,
              lineHeight,
            },
            wordmarkStyle,
          ]}
        >
          Night
        </Text>
        <Text
          numberOfLines={1}
          style={[
            styles.wordmark,
            styles.whisperFallback,
            Platform.OS === 'web' ? styles.whisperGradient : null,
            {
              fontSize,
              lineHeight,
              marginLeft: Math.max(4, Math.round(fontSize * 0.16)),
            },
            wordmarkStyle,
          ]}
        >
          Whisper
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  root: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  fullRoot: {
    maxWidth: '100%',
  },
  symbol: {
    flexShrink: 0,
  },
  wordmarkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    minWidth: 0,
  },
  wordmark: {
    fontWeight: '800',
    includeFontPadding: false,
  },
  night: {
    color: '#F7F5FF',
  },
  whisperFallback: {
    color: affairGoTheme.colors.accentSoft,
  },
  whisperGradient: {
    backgroundImage: 'linear-gradient(90deg, #7657FF 0%, #FF6F91 100%)',
    backgroundClip: 'text',
    WebkitBackgroundClip: 'text',
    color: 'transparent',
    WebkitTextFillColor: 'transparent',
  },
});

export default NightWhisperLogo;