import React from 'react';
import { Text } from 'react-native';

const glyphs = {
  heart: '♥',
  'heart-outline': '♡',
  'arrow-back': '←',
  'eye-outline': '◉',
  'eye-off-outline': '○',
  menu: '☰',
  person: '◔',
  'person-outline': '◌',
  people: '◍',
  'people-outline': '◎',
  'options-outline': '≡',
  location: '⌖',
  'radio-outline': '◉',
  'images-outline': '▣',
  checkmark: '✓',
  'camera-outline': '◫',
  add: '+',
  'log-out-outline': '↩',
  'map-outline': '⌘',
  'swap-horizontal-outline': '⇄',
  'chatbubbles-outline': '☷',
  chatbubbles: '☰',
  'shield-checkmark-outline': '✓',
  'navigate-outline': '➤',
  'chatbubble-ellipses-outline': '…',
  'warning-outline': '!',
  'eye-off-outline': '◌',
  'image-outline': '□',
  'calendar-outline': '◷',
  sparkles: '✦',
  'sparkles-outline': '✧',
  map: '⌘',
};

const resolveGlyph = (name) => glyphs[name] || '•';

const BaseIcon = ({ name, size = 18, color = '#fff', style }) => (
  <Text style={[{ fontSize: size, color, fontWeight: '700', lineHeight: size + 2 }, style]}>{resolveGlyph(name)}</Text>
);

export const Ionicons = BaseIcon;
export const MaterialIcons = BaseIcon;
