import { useState, useRef, useCallback, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  StatusBar,
  Dimensions,
  FlatList,
  Platform,
  Share,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as MediaLibrary from 'expo-media-library';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { MediaPlayerService } from '@/services/MediaPlayerService';
import type { ImageViewerProps, MediaFile } from '@/types/media';

const SLIDESHOW_INTERVAL = 3000;

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface ImageItemProps {
  item: MediaFile;
  isActive: boolean;
}

function ImageItem({ item, isActive }: ImageItemProps) {
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const savedTranslateX = useSharedValue(0);
  const savedTranslateY = useSharedValue(0);

  const resetTransform = useCallback(() => {
    scale.value = withSpring(1);
    translateX.value = withSpring(0);
    translateY.value = withSpring(0);
    savedScale.value = 1;
    savedTranslateX.value = 0;
    savedTranslateY.value = 0;
  }, []);

  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = Math.max(0.5, Math.min(savedScale.value * event.scale, 5));
    })
    .onEnd(() => {
      if (scale.value < 1) {
        scale.value = withSpring(1);
        savedScale.value = 1;
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        savedTranslateX.value = 0;
        savedTranslateY.value = 0;
      } else {
        savedScale.value = scale.value;
      }
    });

  const panGesture = Gesture.Pan()
    .onUpdate((event) => {
      if (savedScale.value > 1) {
        translateX.value = savedTranslateX.value + event.translationX;
        translateY.value = savedTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      savedTranslateX.value = translateX.value;
      savedTranslateY.value = translateY.value;
    });

  const doubleTapGesture = Gesture.Tap()
    .numberOfTaps(2)
    .onEnd((event) => {
      if (scale.value > 1) {
        runOnJS(resetTransform)();
      } else {
        const newScale = 2.5;
        scale.value = withSpring(newScale);
        savedScale.value = newScale;

        const focusX = event.x - SCREEN_WIDTH / 2;
        const focusY = event.y - SCREEN_HEIGHT / 2;
        translateX.value = withSpring(-focusX * (newScale - 1));
        translateY.value = withSpring(-focusY * (newScale - 1));
        savedTranslateX.value = -focusX * (newScale - 1);
        savedTranslateY.value = -focusY * (newScale - 1);
      }
    });

  const composed = Gesture.Simultaneous(
    pinchGesture,
    panGesture,
    doubleTapGesture
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { scale: scale.value },
    ],
  }));

  if (!isActive) {
    return (
      <View style={styles.imageContainer}>
        <Image
          source={{ uri: item.uri }}
          style={styles.image}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <GestureDetector gesture={composed}>
      <View style={styles.imageContainer}>
        <Animated.View style={[styles.imageWrapper, animatedStyle]}>
          <Image
            source={{ uri: item.uri }}
            style={styles.image}
            contentFit="contain"
          />
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

export default function ImageViewer({ images, initialIndex = 0, onClose, showInfo = true }: ImageViewerProps) {
  const { theme, accentColor } = useTheme();
  const insets = useSafeAreaInsets();

  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [showControls, setShowControls] = useState(true);
  const [showInfoPanel, setShowInfoPanel] = useState(false);
  const [slideshowActive, setSlideshowActive] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const slideshowTimerRef = useRef<NodeJS.Timeout | null>(null);

  const controlsOpacity = useSharedValue(1);

  const currentImage = images[currentIndex];

  const goToNextImage = useCallback(() => {
    const nextIndex = currentIndex < images.length - 1 ? currentIndex + 1 : 0;
    flatListRef.current?.scrollToIndex({ index: nextIndex, animated: true });
    setCurrentIndex(nextIndex);
  }, [currentIndex, images.length]);

  const goToPrevImage = useCallback(() => {
    const prevIndex = currentIndex > 0 ? currentIndex - 1 : images.length - 1;
    flatListRef.current?.scrollToIndex({ index: prevIndex, animated: true });
    setCurrentIndex(prevIndex);
  }, [currentIndex, images.length]);

  const toggleSlideshow = useCallback(() => {
    if (slideshowActive) {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
      setSlideshowActive(false);
    } else {
      setSlideshowActive(true);
      controlsOpacity.value = withTiming(0, { duration: 200 });
      setShowControls(false);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [slideshowActive, controlsOpacity]);

  useEffect(() => {
    if (slideshowActive && images.length > 1) {
      slideshowTimerRef.current = setInterval(() => {
        goToNextImage();
      }, SLIDESHOW_INTERVAL);
    }

    return () => {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
    };
  }, [slideshowActive, goToNextImage, images.length]);

  const toggleControls = useCallback(() => {
    if (slideshowActive) {
      if (slideshowTimerRef.current) {
        clearInterval(slideshowTimerRef.current);
        slideshowTimerRef.current = null;
      }
      setSlideshowActive(false);
      controlsOpacity.value = withTiming(1, { duration: 200 });
      setShowControls(true);
      return;
    }

    if (showControls) {
      controlsOpacity.value = withTiming(0, { duration: 200 });
    } else {
      controlsOpacity.value = withTiming(1, { duration: 200 });
    }
    setShowControls(!showControls);
  }, [showControls, slideshowActive, controlsOpacity]);

  const handleShare = async () => {
    try {
      if (Platform.OS === 'web') {
        await Share.share({ url: currentImage.uri });
      } else {
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(currentImage.uri);
        }
      }
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const handleSave = async () => {
    try {
      if (Platform.OS === 'web') {
        Alert.alert('Info', 'Utilisez Expo Go pour sauvegarder des images');
        return;
      }

      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission requise', 'Veuillez autoriser l\'acces a la galerie');
        return;
      }

      await MediaLibrary.saveToLibraryAsync(currentImage.uri);
      Alert.alert('Succes', 'Image enregistree dans la galerie');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (error) {
      console.error('Error saving:', error);
      Alert.alert('Erreur', 'Impossible d\'enregistrer l\'image');
    }
  };

  const handleViewableItemsChanged = useCallback(({ viewableItems }: any) => {
    if (viewableItems.length > 0) {
      setCurrentIndex(viewableItems[0].index);
    }
  }, []);

  const renderItem = useCallback(({ item, index }: { item: MediaFile; index: number }) => (
    <ImageItem item={item} isActive={index === currentIndex} />
  ), [currentIndex]);

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const exif = currentImage.metadata?.exif;

  return (
    <Modal visible={true} animationType="fade" onRequestClose={onClose}>
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.container}>
        <View style={styles.container}>
          <Pressable style={StyleSheet.absoluteFill} onPress={toggleControls}>
            <FlatList
              ref={flatListRef}
              data={images}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={initialIndex}
              getItemLayout={(_, index) => ({
                length: SCREEN_WIDTH,
                offset: SCREEN_WIDTH * index,
                index,
              })}
              onViewableItemsChanged={handleViewableItemsChanged}
              viewabilityConfig={{ itemVisiblePercentThreshold: 50 }}
            />
          </Pressable>

          <Animated.View style={[styles.topBar, { paddingTop: insets.top + 10 }, controlsAnimatedStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
            <Pressable onPress={onClose} style={styles.topButton}>
              <Feather name="x" size={28} color="#FFF" />
            </Pressable>
            <View style={styles.topCenter}>
              <ThemedText style={styles.counterText}>
                {currentIndex + 1} / {images.length}
              </ThemedText>
            </View>
            <Pressable onPress={() => setShowInfoPanel(!showInfoPanel)} style={styles.topButton}>
              <Feather name="info" size={24} color={showInfoPanel ? accentColor : '#FFF'} />
            </Pressable>
          </Animated.View>

          <Animated.View style={[styles.bottomBar, { paddingBottom: insets.bottom + 20 }, controlsAnimatedStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
            <View style={styles.fileInfo}>
              <ThemedText style={styles.fileName} numberOfLines={1}>
                {currentImage.name}
              </ThemedText>
              <ThemedText style={styles.fileSize}>
                {MediaPlayerService.formatFileSize(currentImage.size)}
                {currentImage.metadata?.width && currentImage.metadata?.height && (
                  ` - ${currentImage.metadata.width}x${currentImage.metadata.height}`
                )}
              </ThemedText>
            </View>
            <View style={styles.actions}>
              {images.length > 1 ? (
                <Pressable onPress={toggleSlideshow} style={[styles.actionButton, slideshowActive && styles.actionButtonActive]}>
                  <Feather name={slideshowActive ? "pause" : "play"} size={22} color="#FFF" />
                </Pressable>
              ) : null}
              <Pressable onPress={handleShare} style={styles.actionButton}>
                <Feather name="share" size={22} color="#FFF" />
              </Pressable>
              <Pressable onPress={handleSave} style={styles.actionButton}>
                <Feather name="download" size={22} color="#FFF" />
              </Pressable>
            </View>
          </Animated.View>

          {images.length > 1 && showControls && !slideshowActive ? (
            <>
              <Pressable style={[styles.navButton, styles.navButtonLeft]} onPress={goToPrevImage}>
                <View style={styles.navButtonInner}>
                  <Feather name="chevron-left" size={28} color="#FFF" />
                </View>
              </Pressable>
              <Pressable style={[styles.navButton, styles.navButtonRight]} onPress={goToNextImage}>
                <View style={styles.navButtonInner}>
                  <Feather name="chevron-right" size={28} color="#FFF" />
                </View>
              </Pressable>
            </>
          ) : null}

          {showInfoPanel && (
            <View style={[styles.infoPanel, { paddingBottom: insets.bottom + 20 }]}>
              <View style={styles.infoPanelHeader}>
                <ThemedText style={styles.infoPanelTitle}>Informations</ThemedText>
                <Pressable onPress={() => setShowInfoPanel(false)}>
                  <Feather name="x" size={24} color="#FFF" />
                </Pressable>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Nom</ThemedText>
                <ThemedText style={styles.infoValue}>{currentImage.name}</ThemedText>
              </View>
              <View style={styles.infoRow}>
                <ThemedText style={styles.infoLabel}>Taille</ThemedText>
                <ThemedText style={styles.infoValue}>{MediaPlayerService.formatFileSize(currentImage.size)}</ThemedText>
              </View>
              {currentImage.metadata?.width && currentImage.metadata?.height && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Dimensions</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {currentImage.metadata.width} x {currentImage.metadata.height}
                  </ThemedText>
                </View>
              )}
              {exif?.make && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Appareil</ThemedText>
                  <ThemedText style={styles.infoValue}>{exif.make} {exif.model}</ThemedText>
                </View>
              )}
              {exif?.dateTime && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Date</ThemedText>
                  <ThemedText style={styles.infoValue}>{exif.dateTime}</ThemedText>
                </View>
              )}
              {exif?.fNumber && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Ouverture</ThemedText>
                  <ThemedText style={styles.infoValue}>f/{exif.fNumber}</ThemedText>
                </View>
              )}
              {exif?.exposureTime && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>Exposition</ThemedText>
                  <ThemedText style={styles.infoValue}>{exif.exposureTime}s</ThemedText>
                </View>
              )}
              {exif?.iso && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>ISO</ThemedText>
                  <ThemedText style={styles.infoValue}>{exif.iso}</ThemedText>
                </View>
              )}
              {exif?.gpsLatitude && exif?.gpsLongitude && (
                <View style={styles.infoRow}>
                  <ThemedText style={styles.infoLabel}>GPS</ThemedText>
                  <ThemedText style={styles.infoValue}>
                    {exif.gpsLatitude.toFixed(6)}, {exif.gpsLongitude.toFixed(6)}
                  </ThemedText>
                </View>
              )}
            </View>
          )}
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  imageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
  },
  imageWrapper: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 12,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topButton: {
    padding: 8,
  },
  topCenter: {
    flex: 1,
    alignItems: 'center',
  },
  counterText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  bottomBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  fileInfo: {
    flex: 1,
    marginRight: 16,
  },
  fileName: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  fileSize: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 13,
    marginTop: 4,
  },
  actions: {
    flexDirection: 'row',
    gap: 16,
  },
  actionButton: {
    padding: 10,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: 20,
  },
  actionButtonActive: {
    backgroundColor: 'rgba(74, 222, 128, 0.6)',
  },
  navButton: {
    position: 'absolute',
    top: '50%',
    marginTop: -25,
    zIndex: 10,
  },
  navButtonLeft: {
    left: 10,
  },
  navButtonRight: {
    right: 10,
  },
  navButtonInner: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoPanel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.85)',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 20,
    maxHeight: SCREEN_HEIGHT * 0.6,
  },
  infoPanelHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  infoPanelTitle: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: '700',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
  },
  infoValue: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '500',
    maxWidth: '60%',
    textAlign: 'right',
  },
});
