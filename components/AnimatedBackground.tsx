import React, { useEffect } from 'react';
import { StyleSheet, View, Dimensions, Platform } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
  interpolate,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AnimatedBackgroundConfig } from '@/constants/themes/types';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface AnimatedBackgroundProps {
  config?: AnimatedBackgroundConfig;
}

const getAnimationDuration = (speed?: 'slow' | 'medium' | 'fast'): number => {
  switch (speed) {
    case 'fast': return 3000;
    case 'medium': return 6000;
    case 'slow':
    default: return 10000;
  }
};

const GradientAnimation = ({ config }: { config: AnimatedBackgroundConfig }) => {
  const progress = useSharedValue(0);
  const duration = getAnimationDuration(config.speed);

  useEffect(() => {
    progress.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(progress.value, [0, 1], [-SCREEN_WIDTH * 0.3, SCREEN_WIDTH * 0.3]) },
      { scale: interpolate(progress.value, [0, 0.5, 1], [1, 1.2, 1]) },
    ],
  }));

  return (
    <View style={[styles.container, { opacity: config.opacity || 0.3 }]}>
      <Animated.View style={[styles.gradientContainer, animatedStyle]}>
        <LinearGradient
          colors={(config.colors.length >= 2 ? config.colors : ['#000', '#111', ...config.colors]) as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </Animated.View>
    </View>
  );
};

const WavesAnimation = ({ config }: { config: AnimatedBackgroundConfig }) => {
  const wave1 = useSharedValue(0);
  const wave2 = useSharedValue(0);
  const duration = getAnimationDuration(config.speed);

  useEffect(() => {
    wave1.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
    wave2.value = withRepeat(
      withTiming(1, { duration: duration * 1.3, easing: Easing.inOut(Easing.sin) }),
      -1,
      true
    );
  }, []);

  const wave1Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave1.value, [0, 1], [0, 30]) },
      { scaleX: interpolate(wave1.value, [0, 0.5, 1], [1, 1.05, 1]) },
    ],
  }));

  const wave2Style = useAnimatedStyle(() => ({
    transform: [
      { translateY: interpolate(wave2.value, [0, 1], [15, -15]) },
      { scaleX: interpolate(wave2.value, [0, 0.5, 1], [1.05, 1, 1.05]) },
    ],
  }));

  const colors = config.colors as readonly [string, string, ...string[]];

  return (
    <View style={[styles.container, { opacity: config.opacity || 0.3 }]}>
      <Animated.View style={[styles.waveContainer, { top: '40%' }, wave1Style]}>
        <LinearGradient
          colors={[colors[0], colors[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.wave}
        />
      </Animated.View>
      <Animated.View style={[styles.waveContainer, { top: '60%' }, wave2Style]}>
        <LinearGradient
          colors={[colors[2] || colors[1], colors[3] || colors[0]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.wave}
        />
      </Animated.View>
    </View>
  );
};

const ParticlesAnimation = ({ config }: { config: AnimatedBackgroundConfig }) => {
  const particles = Array.from({ length: 8 }, (_, i) => ({
    id: i,
    initialX: Math.random() * SCREEN_WIDTH,
    initialY: Math.random() * SCREEN_HEIGHT,
    size: 20 + Math.random() * 40,
    color: config.colors[i % config.colors.length],
  }));

  return (
    <View style={[styles.container, { opacity: config.opacity || 0.3 }]}>
      {particles.map((particle) => (
        <Particle key={particle.id} {...particle} speed={config.speed} />
      ))}
    </View>
  );
};

const Particle = ({ 
  initialX, 
  initialY, 
  size, 
  color,
  speed 
}: { 
  initialX: number; 
  initialY: number; 
  size: number; 
  color: string;
  speed?: 'slow' | 'medium' | 'fast';
}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const scale = useSharedValue(1);
  const duration = getAnimationDuration(speed);

  useEffect(() => {
    const randomOffset = Math.random() * 2000;
    setTimeout(() => {
      translateY.value = withRepeat(
        withSequence(
          withTiming(-50, { duration: duration * 0.5, easing: Easing.inOut(Easing.ease) }),
          withTiming(50, { duration: duration * 0.5, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      translateX.value = withRepeat(
        withSequence(
          withTiming(30, { duration: duration * 0.7, easing: Easing.inOut(Easing.ease) }),
          withTiming(-30, { duration: duration * 0.7, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
      scale.value = withRepeat(
        withSequence(
          withTiming(1.3, { duration: duration * 0.4, easing: Easing.inOut(Easing.ease) }),
          withTiming(0.8, { duration: duration * 0.4, easing: Easing.inOut(Easing.ease) })
        ),
        -1,
        true
      );
    }, randomOffset);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  return (
    <Animated.View
      style={[
        styles.particle,
        {
          left: initialX,
          top: initialY,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

const AuroraAnimation = ({ config }: { config: AnimatedBackgroundConfig }) => {
  const aurora1 = useSharedValue(0);
  const aurora2 = useSharedValue(0);
  const aurora3 = useSharedValue(0);
  const duration = getAnimationDuration(config.speed);

  useEffect(() => {
    aurora1.value = withRepeat(
      withTiming(1, { duration, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    aurora2.value = withRepeat(
      withTiming(1, { duration: duration * 1.2, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
    aurora3.value = withRepeat(
      withTiming(1, { duration: duration * 0.8, easing: Easing.inOut(Easing.ease) }),
      -1,
      true
    );
  }, []);

  const aurora1Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(aurora1.value, [0, 1], [-100, 100]) },
      { scaleY: interpolate(aurora1.value, [0, 0.5, 1], [1, 1.3, 1]) },
      { rotate: `${interpolate(aurora1.value, [0, 1], [-5, 5])}deg` },
    ],
  }));

  const aurora2Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(aurora2.value, [0, 1], [50, -50]) },
      { scaleY: interpolate(aurora2.value, [0, 0.5, 1], [1.2, 1, 1.2]) },
      { rotate: `${interpolate(aurora2.value, [0, 1], [3, -3])}deg` },
    ],
  }));

  const aurora3Style = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(aurora3.value, [0, 1], [-30, 70]) },
      { scaleY: interpolate(aurora3.value, [0, 0.5, 1], [1, 1.5, 1]) },
    ],
  }));

  const colors = config.colors as readonly [string, string, ...string[]];

  return (
    <View style={[styles.container, { opacity: config.opacity || 0.35 }]}>
      <Animated.View style={[styles.auroraStrip, { top: '10%' }, aurora1Style]}>
        <LinearGradient
          colors={[`${colors[0]}00`, colors[0], `${colors[0]}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.auroraGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.auroraStrip, { top: '25%' }, aurora2Style]}>
        <LinearGradient
          colors={[`${colors[1]}00`, colors[1], `${colors[1]}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.auroraGradient}
        />
      </Animated.View>
      <Animated.View style={[styles.auroraStrip, { top: '40%' }, aurora3Style]}>
        <LinearGradient
          colors={[`${colors[2]}00`, colors[2] || colors[0], `${colors[2]}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.auroraGradient}
        />
      </Animated.View>
    </View>
  );
};

const BubblesAnimation = ({ config }: { config: AnimatedBackgroundConfig }) => {
  const bubbles = Array.from({ length: 6 }, (_, i) => ({
    id: i,
    initialX: (SCREEN_WIDTH / 6) * i + Math.random() * 50,
    initialY: SCREEN_HEIGHT + 100,
    size: 30 + Math.random() * 50,
    color: config.colors[i % config.colors.length],
    delay: i * 800,
  }));

  return (
    <View style={[styles.container, { opacity: config.opacity || 0.2 }]}>
      {bubbles.map((bubble) => (
        <Bubble key={bubble.id} {...bubble} speed={config.speed} />
      ))}
    </View>
  );
};

const Bubble = ({
  initialX,
  size,
  color,
  delay,
  speed,
}: {
  initialX: number;
  initialY: number;
  size: number;
  color: string;
  delay: number;
  speed?: 'slow' | 'medium' | 'fast';
}) => {
  const translateY = useSharedValue(0);
  const translateX = useSharedValue(0);
  const opacity = useSharedValue(0);
  const duration = getAnimationDuration(speed) * 2;

  useEffect(() => {
    setTimeout(() => {
      translateY.value = withRepeat(
        withTiming(-SCREEN_HEIGHT - 200, { duration, easing: Easing.linear }),
        -1,
        false
      );
      translateX.value = withRepeat(
        withSequence(
          withTiming(20, { duration: duration * 0.25, easing: Easing.inOut(Easing.sin) }),
          withTiming(-20, { duration: duration * 0.5, easing: Easing.inOut(Easing.sin) }),
          withTiming(0, { duration: duration * 0.25, easing: Easing.inOut(Easing.sin) })
        ),
        -1,
        false
      );
      opacity.value = withRepeat(
        withSequence(
          withTiming(1, { duration: duration * 0.1 }),
          withTiming(1, { duration: duration * 0.7 }),
          withTiming(0, { duration: duration * 0.2 })
        ),
        -1,
        false
      );
    }, delay);
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
    ],
    opacity: opacity.value,
  }));

  return (
    <Animated.View
      style={[
        styles.bubble,
        {
          left: initialX,
          bottom: -100,
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: color,
        },
        animatedStyle,
      ]}
    />
  );
};

export function AnimatedBackground({ config }: AnimatedBackgroundProps) {
  if (!config || config.type === 'none') {
    return null;
  }

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.container, { opacity: config.opacity || 0.3 }]}>
        <LinearGradient
          colors={(config.colors.length >= 2 ? config.colors : ['#000', '#111', ...config.colors]) as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.gradient}
        />
      </View>
    );
  }

  switch (config.type) {
    case 'gradient':
      return <GradientAnimation config={config} />;
    case 'waves':
      return <WavesAnimation config={config} />;
    case 'particles':
      return <ParticlesAnimation config={config} />;
    case 'aurora':
      return <AuroraAnimation config={config} />;
    case 'bubbles':
      return <BubblesAnimation config={config} />;
    default:
      return null;
  }
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    overflow: 'hidden',
    zIndex: -1,
    pointerEvents: 'none',
  },
  gradientContainer: {
    width: SCREEN_WIDTH * 2,
    height: SCREEN_HEIGHT * 2,
    position: 'absolute',
    top: -SCREEN_HEIGHT * 0.5,
    left: -SCREEN_WIDTH * 0.5,
  },
  gradient: {
    flex: 1,
  },
  waveContainer: {
    position: 'absolute',
    width: SCREEN_WIDTH * 2,
    height: SCREEN_HEIGHT * 0.5,
    left: -SCREEN_WIDTH * 0.5,
  },
  wave: {
    flex: 1,
    borderRadius: 200,
  },
  particle: {
    position: 'absolute',
  },
  auroraStrip: {
    position: 'absolute',
    width: SCREEN_WIDTH * 1.5,
    height: 80,
    left: -SCREEN_WIDTH * 0.25,
  },
  auroraGradient: {
    flex: 1,
    borderRadius: 40,
  },
  bubble: {
    position: 'absolute',
  },
});
