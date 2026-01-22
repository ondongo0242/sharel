import React, { forwardRef, useImperativeHandle, useRef, useState } from 'react';
import { View, StyleSheet, Platform, ScrollView, Dimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useSharedValue, useAnimatedStyle, withSpring, runOnJS } from 'react-native-reanimated';

let PagerView: any = null;
if (Platform.OS !== 'web') {
  try {
    PagerView = require('react-native-pager-view').default;
  } catch (e) {
    console.log('react-native-pager-view not available');
  }
}

interface SwipeablePagerProps {
  children: React.ReactNode[];
  initialPage?: number;
  onPageSelected?: (index: number) => void;
  style?: any;
}

export interface SwipeablePagerRef {
  setPage: (index: number) => void;
}

const SwipeablePager = forwardRef<SwipeablePagerRef, SwipeablePagerProps>(
  ({ children, initialPage = 0, onPageSelected, style }, ref) => {
    const pagerRef = useRef<any>(null);
    const [currentIndex, setCurrentIndex] = useState(initialPage);
    const { width: screenWidth } = Dimensions.get('window');

    useImperativeHandle(ref, () => ({
      setPage: (index: number) => {
        if (Platform.OS === 'web') {
          setCurrentIndex(index);
          onPageSelected?.(index);
        } else if (pagerRef.current) {
          pagerRef.current.setPage(index);
        }
      },
    }));

    const handlePageSelected = (e: any) => {
      const position = e.nativeEvent.position;
      setCurrentIndex(position);
      onPageSelected?.(position);
    };

    if (Platform.OS === 'web') {
      const translateX = useSharedValue(-currentIndex * screenWidth);
      const startX = useSharedValue(0);

      const updatePage = (newIndex: number) => {
        setCurrentIndex(newIndex);
        onPageSelected?.(newIndex);
      };

      const panGesture = Gesture.Pan()
        .onStart(() => {
          startX.value = translateX.value;
        })
        .onUpdate((event) => {
          const newTranslate = startX.value + event.translationX;
          const minTranslate = -(children.length - 1) * screenWidth;
          translateX.value = Math.max(minTranslate, Math.min(0, newTranslate));
        })
        .onEnd((event) => {
          const swipeThreshold = screenWidth * 0.2;
          const velocityThreshold = 500;
          
          let newIndex = currentIndex;
          
          if (Math.abs(event.velocityX) > velocityThreshold) {
            if (event.velocityX > 0 && currentIndex > 0) {
              newIndex = currentIndex - 1;
            } else if (event.velocityX < 0 && currentIndex < children.length - 1) {
              newIndex = currentIndex + 1;
            }
          } else if (Math.abs(event.translationX) > swipeThreshold) {
            if (event.translationX > 0 && currentIndex > 0) {
              newIndex = currentIndex - 1;
            } else if (event.translationX < 0 && currentIndex < children.length - 1) {
              newIndex = currentIndex + 1;
            }
          }
          
          translateX.value = withSpring(-newIndex * screenWidth, {
            damping: 20,
            stiffness: 200,
          });
          
          if (newIndex !== currentIndex) {
            runOnJS(updatePage)(newIndex);
          }
        });

      const animatedStyle = useAnimatedStyle(() => ({
        transform: [{ translateX: translateX.value }],
      }));

      React.useEffect(() => {
        translateX.value = withSpring(-currentIndex * screenWidth, {
          damping: 20,
          stiffness: 200,
        });
      }, [currentIndex, screenWidth]);

      return (
        <View style={[styles.pager, style]}>
          <GestureDetector gesture={panGesture}>
            <Animated.View style={[styles.webPagerContent, animatedStyle, { width: screenWidth * children.length }]}>
              {React.Children.map(children, (child, index) => (
                <View key={index} style={[styles.page, { width: screenWidth }]}>
                  {child}
                </View>
              ))}
            </Animated.View>
          </GestureDetector>
        </View>
      );
    }

    if (!PagerView) {
      return (
        <View style={[styles.pager, style]}>
          {React.Children.map(children, (child, index) => (
            index === currentIndex ? (
              <View key={index} style={styles.page}>
                {child}
              </View>
            ) : null
          ))}
        </View>
      );
    }

    return (
      <PagerView
        ref={pagerRef}
        style={[styles.pager, style]}
        initialPage={initialPage}
        onPageSelected={handlePageSelected}
        offscreenPageLimit={children.length}
      >
        {React.Children.map(children, (child, index) => (
          <View key={index} style={styles.page}>
            {child}
          </View>
        ))}
      </PagerView>
    );
  }
);

const styles = StyleSheet.create({
  pager: {
    flex: 1,
    overflow: 'hidden',
  },
  page: {
    flex: 1,
  },
  webPagerContent: {
    flexDirection: 'row',
    flex: 1,
  },
});

export default SwipeablePager;
