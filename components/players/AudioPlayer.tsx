import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { Audio, AVPlaybackStatus } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withRepeat,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useMediaPlayer } from '@/contexts/MediaPlayerContext';
import { MediaPlayerService } from '@/services/MediaPlayerService';
import type { AudioPlayerProps, MediaFile, RepeatMode, PlaybackSpeed } from '@/types/media';

const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.5, 0.75, 1, 1.25, 1.5, 2];

export default function AudioPlayer({ source, queue = [], autoPlay = true, onClose, onEnd }: AudioPlayerProps) {
  const { theme, isDark, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { 
    queue: contextQueue, 
    setQueue, 
    next, 
    previous, 
    setRepeatMode: setContextRepeatMode,
    toggleShuffle,
    updatePlaybackState 
  } = useMediaPlayer();

  const soundRef = useRef<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [volume, setVolume] = useState(1);
  const [repeatMode, setRepeatMode] = useState<RepeatMode>('off');
  const [shuffleOn, setShuffleOn] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [showQueue, setShowQueue] = useState(false);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const rotation = useSharedValue(0);
  const scale = useSharedValue(1);

  const { width: screenWidth } = Dimensions.get('window');
  const albumArtSize = screenWidth - 80;

  useEffect(() => {
    setupAudio();
    loadSound();

    return () => {
      unloadSound();
    };
  }, [source.uri]);

  useEffect(() => {
    if (isPlaying) {
      rotation.value = withRepeat(
        withTiming(360, { duration: 20000, easing: Easing.linear }),
        -1,
        false
      );
    } else {
      rotation.value = withTiming(rotation.value, { duration: 0 });
    }
  }, [isPlaying]);

  useEffect(() => {
    if (queue.length > 0) {
      setQueue(queue, queue.findIndex(q => q.uri === source.uri) || 0);
    }
  }, []);

  const setupAudio = async () => {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      staysActiveInBackground: true,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
    });
  };

  const loadSound = async () => {
    try {
      setIsLoading(true);

      if (soundRef.current) {
        await soundRef.current.unloadAsync();
      }

      const { sound } = await Audio.Sound.createAsync(
        { uri: source.uri },
        { shouldPlay: autoPlay, volume, rate: playbackSpeed },
        onPlaybackStatusUpdate
      );

      soundRef.current = sound;
      setIsLoading(false);
      setIsFavorite(MediaPlayerService.isFavorite(source.id));

      const savedPosition = await MediaPlayerService.getPosition(source.id);
      if (savedPosition > 0 && savedPosition < duration * 0.95) {
        await sound.setPositionAsync(savedPosition * 1000);
      }
    } catch (error) {
      console.error('Error loading sound:', error);
      setIsLoading(false);
    }
  };

  const unloadSound = async () => {
    if (soundRef.current) {
      await MediaPlayerService.savePosition(source.id, position);
      await soundRef.current.unloadAsync();
      soundRef.current = null;
    }
  };

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) return;

    setIsPlaying(status.isPlaying);
    setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
    setPosition(status.positionMillis / 1000);

    updatePlaybackState({
      isPlaying: status.isPlaying,
      position: status.positionMillis / 1000,
      duration: status.durationMillis ? status.durationMillis / 1000 : 0,
    });

    if (status.didJustFinish) {
      handleTrackEnd();
    }
  };

  const handleTrackEnd = () => {
    if (repeatMode === 'one') {
      seekTo(0);
      togglePlay();
    } else if (contextQueue.items.length > 1) {
      next();
    } else if (repeatMode === 'all') {
      seekTo(0);
      togglePlay();
    } else {
      onEnd?.();
    }
  };

  const togglePlay = async () => {
    if (!soundRef.current) return;
    if (isPlaying) {
      await soundRef.current.pauseAsync();
    } else {
      await soundRef.current.playAsync();
    }
    scale.value = withSpring(1.1, {}, () => {
      scale.value = withSpring(1);
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const seekTo = async (pos: number) => {
    if (!soundRef.current) return;
    await soundRef.current.setPositionAsync(pos * 1000);
  };

  const seekForward = async () => {
    const newPos = Math.min(position + 15, duration);
    await seekTo(newPos);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const seekBackward = async () => {
    const newPos = Math.max(position - 15, 0);
    await seekTo(newPos);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handlePrevious = async () => {
    if (position > 3) {
      await seekTo(0);
    } else {
      previous();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleNext = async () => {
    next();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const cycleRepeatMode = () => {
    const modes: RepeatMode[] = ['off', 'all', 'one'];
    const currentIndex = modes.indexOf(repeatMode);
    const nextMode = modes[(currentIndex + 1) % modes.length];
    setRepeatMode(nextMode);
    setContextRepeatMode(nextMode);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleShuffle = () => {
    setShuffleOn(!shuffleOn);
    toggleShuffle();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const changeSpeed = async (speed: PlaybackSpeed) => {
    if (!soundRef.current) return;
    await soundRef.current.setRateAsync(speed, true);
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleFavorite = async () => {
    const isFav = await MediaPlayerService.toggleFavorite(source.id);
    setIsFavorite(isFav);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const handleClose = async () => {
    await unloadSound();
    onClose?.();
  };

  const rotateStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const formatTime = (seconds: number) => MediaPlayerService.formatDuration(seconds);

  const getRepeatIcon = () => {
    switch (repeatMode) {
      case 'one': return 'repeat';
      case 'all': return 'repeat';
      default: return 'repeat';
    }
  };

  const albumArt = source.metadata?.albumArt || source.thumbnail;

  const renderQueueItem = ({ item, index }: { item: MediaFile; index: number }) => (
    <Pressable
      style={[
        styles.queueItem,
        contextQueue.currentIndex === index && { backgroundColor: accentColor + '20' }
      ]}
      onPress={() => {
        contextQueue.items[index] && setQueue(contextQueue.items, index);
      }}
    >
      <View style={[styles.queueItemArt, { backgroundColor: theme.backgroundSecondary }]}>
        {item.metadata?.albumArt ? (
          <Image source={{ uri: item.metadata.albumArt }} style={styles.queueItemArtImage} />
        ) : (
          <Feather name="music" size={20} color={theme.textSecondary} />
        )}
      </View>
      <View style={styles.queueItemInfo}>
        <ThemedText style={[styles.queueItemTitle, { color: theme.text }]} numberOfLines={1}>
          {item.metadata?.title || item.name}
        </ThemedText>
        <ThemedText style={[styles.queueItemArtist, { color: theme.textSecondary }]} numberOfLines={1}>
          {item.metadata?.artist || 'Artiste inconnu'}
        </ThemedText>
      </View>
      {contextQueue.currentIndex === index && (
        <Feather name="volume-2" size={18} color={accentColor} />
      )}
    </Pressable>
  );

  return (
    <Modal visible={true} animationType="slide" onRequestClose={handleClose}>
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <LinearGradient
          colors={[accentColor + '40', 'transparent']}
          style={styles.gradientBackground}
        />

        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <Pressable onPress={handleClose} style={styles.headerButton}>
            <Feather name="chevron-down" size={28} color={theme.text} />
          </Pressable>
          <View style={styles.headerCenter}>
            <ThemedText style={[styles.headerSubtitle, { color: theme.textSecondary }]}>
              LECTURE EN COURS
            </ThemedText>
          </View>
          <Pressable onPress={() => setShowQueue(!showQueue)} style={styles.headerButton}>
            <Feather name="list" size={24} color={showQueue ? accentColor : theme.text} />
          </Pressable>
        </View>

        {showQueue ? (
          <View style={styles.queueContainer}>
            <ThemedText style={[styles.queueTitle, { color: theme.text }]}>
              File d'attente ({contextQueue.items.length})
            </ThemedText>
            <FlatList
              data={contextQueue.items}
              renderItem={renderQueueItem}
              keyExtractor={(item) => item.id}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 200 }}
            />
          </View>
        ) : (
          <View style={styles.mainContent}>
            <View style={[styles.albumArtContainer, { width: albumArtSize, height: albumArtSize }]}>
              <Animated.View style={[styles.albumArtWrapper, rotateStyle]}>
                {albumArt ? (
                  <Image source={{ uri: albumArt }} style={styles.albumArt} />
                ) : (
                  <View style={[styles.albumArtPlaceholder, { backgroundColor: theme.backgroundSecondary }]}>
                    <Feather name="music" size={80} color={theme.textSecondary} />
                  </View>
                )}
                <View style={[styles.vinylCenter, { backgroundColor: theme.backgroundRoot }]} />
              </Animated.View>
            </View>

            <View style={styles.trackInfo}>
              <ThemedText style={[styles.trackTitle, { color: theme.text }]} numberOfLines={1}>
                {source.metadata?.title || source.name}
              </ThemedText>
              <ThemedText style={[styles.trackArtist, { color: theme.textSecondary }]} numberOfLines={1}>
                {source.metadata?.artist || 'Artiste inconnu'}
              </ThemedText>
              {source.metadata?.album && (
                <ThemedText style={[styles.trackAlbum, { color: theme.textSecondary }]} numberOfLines={1}>
                  {source.metadata.album}
                </ThemedText>
              )}
            </View>

            <View style={styles.progressSection}>
              <Pressable
                style={styles.progressBar}
                onPress={(e) => {
                  const progress = e.nativeEvent.locationX / (screenWidth - 48);
                  seekTo(progress * duration);
                }}
              >
                <View style={[styles.progressTrack, { backgroundColor: theme.border }]}>
                  <View style={[styles.progressFill, { width: `${(position / duration) * 100}%`, backgroundColor: accentColor }]} />
                </View>
              </Pressable>
              <View style={styles.timeRow}>
                <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                  {formatTime(position)}
                </ThemedText>
                <ThemedText style={[styles.timeText, { color: theme.textSecondary }]}>
                  -{formatTime(duration - position)}
                </ThemedText>
              </View>
            </View>

            <View style={styles.mainControls}>
              <Pressable onPress={handleShuffle} style={styles.secondaryControl}>
                <Feather name="shuffle" size={22} color={shuffleOn ? accentColor : theme.textSecondary} />
              </Pressable>
              <Pressable onPress={handlePrevious} style={styles.skipButton}>
                <Feather name="skip-back" size={32} color={theme.text} />
              </Pressable>
              <Animated.View style={scaleStyle}>
                <Pressable onPress={togglePlay} style={[styles.playButton, { backgroundColor: accentColor }]}>
                  <Feather name={isPlaying ? 'pause' : 'play'} size={36} color="#FFF" />
                </Pressable>
              </Animated.View>
              <Pressable onPress={handleNext} style={styles.skipButton}>
                <Feather name="skip-forward" size={32} color={theme.text} />
              </Pressable>
              <Pressable onPress={cycleRepeatMode} style={styles.secondaryControl}>
                <Feather name={getRepeatIcon()} size={22} color={repeatMode !== 'off' ? accentColor : theme.textSecondary} />
                {repeatMode === 'one' && (
                  <View style={[styles.repeatOneBadge, { backgroundColor: accentColor }]}>
                    <ThemedText style={styles.repeatOneText}>1</ThemedText>
                  </View>
                )}
              </Pressable>
            </View>

            <View style={styles.extraControls}>
              <Pressable onPress={handleFavorite} style={styles.extraButton}>
                <Feather name="heart" size={22} color={isFavorite ? '#FF3B30' : theme.textSecondary} fill={isFavorite ? '#FF3B30' : 'none'} />
              </Pressable>
              <Pressable onPress={() => setShowSpeedMenu(true)} style={styles.extraButton}>
                <ThemedText style={[styles.speedBadge, { color: playbackSpeed !== 1 ? accentColor : theme.textSecondary }]}>
                  {playbackSpeed}x
                </ThemedText>
              </Pressable>
              <Pressable style={styles.extraButton}>
                <Feather name="share" size={22} color={theme.textSecondary} />
              </Pressable>
            </View>
          </View>
        )}

        {showSpeedMenu && (
          <View style={styles.menuOverlay}>
            <Pressable style={styles.menuBackdrop} onPress={() => setShowSpeedMenu(false)} />
            <View style={[styles.speedMenu, { backgroundColor: theme.backgroundDefault }]}>
              <ThemedText style={[styles.menuTitle, { color: theme.text }]}>Vitesse de lecture</ThemedText>
              {PLAYBACK_SPEEDS.map((speed) => (
                <Pressable
                  key={speed}
                  style={[styles.menuItem, playbackSpeed === speed && { backgroundColor: accentColor + '20' }]}
                  onPress={() => changeSpeed(speed)}
                >
                  <ThemedText style={[styles.menuItemText, { color: playbackSpeed === speed ? accentColor : theme.text }]}>
                    {speed}x
                  </ThemedText>
                  {playbackSpeed === speed && <Feather name="check" size={20} color={accentColor} />}
                </Pressable>
              ))}
            </View>
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  gradientBackground: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 400,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerButton: {
    padding: 8,
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerSubtitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  mainContent: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  albumArtContainer: {
    borderRadius: 999,
    overflow: 'hidden',
    marginTop: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  albumArtWrapper: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    overflow: 'hidden',
  },
  albumArt: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
  },
  albumArtPlaceholder: {
    width: '100%',
    height: '100%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  vinylCenter: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 60,
    height: 60,
    borderRadius: 30,
    marginTop: -30,
    marginLeft: -30,
  },
  trackInfo: {
    alignItems: 'center',
    marginTop: 32,
    paddingHorizontal: 20,
  },
  trackTitle: {
    fontSize: 22,
    fontWeight: '700',
    textAlign: 'center',
  },
  trackArtist: {
    fontSize: 16,
    marginTop: 6,
  },
  trackAlbum: {
    fontSize: 14,
    marginTop: 4,
  },
  progressSection: {
    width: '100%',
    marginTop: 32,
  },
  progressBar: {
    height: 30,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
  },
  timeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  mainControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 24,
  },
  secondaryControl: {
    padding: 8,
    position: 'relative',
  },
  skipButton: {
    padding: 12,
  },
  playButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 4,
  },
  repeatOneBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 14,
    height: 14,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  repeatOneText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: '700',
  },
  extraControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 32,
    gap: 40,
  },
  extraButton: {
    padding: 12,
  },
  speedBadge: {
    fontSize: 14,
    fontWeight: '600',
  },
  queueContainer: {
    flex: 1,
    paddingHorizontal: 16,
  },
  queueTitle: {
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  queueItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
    marginBottom: 4,
  },
  queueItemArt: {
    width: 48,
    height: 48,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  queueItemArtImage: {
    width: '100%',
    height: '100%',
  },
  queueItemInfo: {
    flex: 1,
    marginLeft: 12,
  },
  queueItemTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  queueItemArtist: {
    fontSize: 13,
    marginTop: 2,
  },
  menuOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  speedMenu: {
    borderRadius: 16,
    padding: 20,
    minWidth: 220,
  },
  menuTitle: {
    fontSize: 17,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemText: {
    fontSize: 16,
  },
});
