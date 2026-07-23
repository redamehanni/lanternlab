import React, { useEffect, useRef } from 'react';
import { Animated, View } from 'react-native';
import { MOTION } from '../../theme';

/**
 * Apparition douce — encre qui s'installe sur le papier.
 */
export default function FadeIn({
  children,
  delay = 0,
  style,
  duration = MOTION.fadeIn.duration,
  translateY = MOTION.fadeIn.translateY,
}) {
  const opacity = useRef(new Animated.Value(0)).current;
  const ty = useRef(new Animated.Value(translateY)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration,
        delay,
        useNativeDriver: true,
      }),
      Animated.spring(ty, {
        toValue: 0,
        delay,
        useNativeDriver: true,
        ...MOTION.spring.soft,
      }),
    ]).start();
  }, [delay, duration, opacity, ty]);

  return (
    <Animated.View style={[style, { opacity, transform: [{ translateY: ty }] }]}>
      {children}
    </Animated.View>
  );
}

export function PressableScale({ children, onPress, style, disabled }) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () =>
    Animated.spring(scale, {
      toValue: MOTION.press.scaleIn,
      useNativeDriver: true,
      ...MOTION.spring.gentle,
    }).start();
  const pressOut = () =>
    Animated.spring(scale, {
      toValue: MOTION.press.scaleOut,
      useNativeDriver: true,
      ...MOTION.spring.settle,
    }).start();

  return (
    <Animated.View style={[{ transform: [{ scale }] }, style]}>
      <View
        onStartShouldSetResponder={() => !disabled}
        onResponderGrant={pressIn}
        onResponderRelease={() => {
          pressOut();
          if (!disabled && onPress) onPress();
        }}
        onResponderTerminate={pressOut}
      >
        {children}
      </View>
    </Animated.View>
  );
}
