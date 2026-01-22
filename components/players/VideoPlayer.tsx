import { useState, useRef, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  StatusBar,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Video, ResizeMode, AVPlaybackStatus } from 'expo-av';
import { Feather } from '@expo/vector-icons';
import * as ScreenOrientation from 'expo-screen-orientation';
import * as Brightness from 'expo-brightness';
import * as Haptics from 'expo-haptics';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  runOnJS,
  withSpring,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { useMediaPlayer } from '@/contexts/MediaPlayerContext';
import { MediaPlayerService } from '@/services/MediaPlayerService';
import { parseSubtitles, getCurrentCue } from '@/utils/subtitles';
import type { VideoPlayerProps, PlaybackSpeed, SubtitleCue, SubtitleTrack } from '@/types/media';

const SEEK_TIME = 10;
const PLAYBACK_SPEEDS: PlaybackSpeed[] = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
const CONTROL_TIMEOUT = 4000;

export default function VideoPlayer({ source, autoPlay = true, onClose, onEnd, subtitles = [], initialPosition = 0 }: VideoPlayerProps) {
  const { theme, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { updatePlaybackState, playbackState } = useMediaPlayer();

  const videoRef = useRef<Video>(null);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [isBuffering, setIsBuffering] = useState(true);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [playbackSpeed, setPlaybackSpeed] = useState<PlaybackSpeed>(1);
  const [isFullscreen, setIsFullscreen] = useState(true);
  const [showSpeedMenu, setShowSpeedMenu] = useState(false);
  const [showSubtitleMenu, setShowSubtitleMenu] = useState(false);
  const [currentSubtitle, setCurrentSubtitle] = useState<SubtitleTrack | null>(null);
  const [subtitleCues, setSubtitleCues] = useState<SubtitleCue[]>([]);
  const [currentCue, setCurrentCue] = useState<SubtitleCue | null>(null);
  const [brightness, setBrightness] = useState(0.5);
  const [showBrightnessIndicator, setShowBrightnessIndicator] = useState(false);
  const [showVolumeIndicator, setShowVolumeIndicator] = useState(false);
  const [seekIndicator, setSeekIndicator] = useState<{ show: boolean; direction: 'forward' | 'backward'; seconds: number }>({ show: false, direction: 'forward', seconds: 0 });

  const controlsOpacity = useSharedValue(1);
  const doubleTapScale = useSharedValue(1);

  const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

  useEffect(() => {
    const loadInitialBrightness = async () => {
      if (Platform.OS !== 'web') {
        try {
          const current = await Brightness.getBrightnessAsync();
          setBrightness(current);
        } catch (e) {}
      }
    };
    loadInitialBrightness();
    lockLandscape();

    return () => {
      unlockOrientation();
      if (controlsTimeout.current) {
        clearTimeout(controlsTimeout.current);
      }
    };
  }, []);

  useEffect(() => {
    if (currentSubtitle) {
      loadSubtitles(currentSubtitle);
    } else {
      setSubtitleCues([]);
      setCurrentCue(null);
    }
  }, [currentSubtitle]);

  useEffect(() => {
    if (subtitleCues.length > 0) {
      const cue = getCurrentCue(subtitleCues, position);
      setCurrentCue(cue);
    }
  }, [position, subtitleCues]);

  const loadSubtitles = async (track: SubtitleTrack) => {
    const cues = await parseSubtitles(track);
    setSubtitleCues(cues);
  };

  const lockLandscape = async () => {
    if (Platform.OS !== 'web') {
      await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
    }
  };

  const unlockOrientation = async () => {
    if (Platform.OS !== 'web') {
      await ScreenOrientation.unlockAsync();
    }
  };

  const hideControlsDelayed = useCallback(() => {
    if (controlsTimeout.current) {
      clearTimeout(controlsTimeout.current);
    }
    controlsTimeout.current = setTimeout(() => {
      if (isPlaying) {
        controlsOpacity.value = withTiming(0, { duration: 300 });
        setShowControls(false);
      }
    }, CONTROL_TIMEOUT);
  }, [isPlaying, controlsOpacity]);

  const showControlsNow = useCallback(() => {
    setShowControls(true);
    controlsOpacity.value = withTiming(1, { duration: 200 });
    hideControlsDelayed();
  }, [controlsOpacity, hideControlsDelayed]);

  const toggleControls = useCallback(() => {
    if (showControls) {
      controlsOpacity.value = withTiming(0, { duration: 300 });
      setShowControls(false);
    } else {
      showControlsNow();
    }
  }, [showControls, controlsOpacity, showControlsNow]);

  const onPlaybackStatusUpdate = (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      if (status.error) {
        console.error('Playback error:', status.error);
      }
      return;
    }

    setIsBuffering(status.isBuffering);
    setDuration(status.durationMillis ? status.durationMillis / 1000 : 0);
    setPosition(status.positionMillis / 1000);
    setIsPlaying(status.isPlaying);

    updatePlaybackState({
      isPlaying: status.isPlaying,
      isBuffering: status.isBuffering,
      position: status.positionMillis / 1000,
      duration: status.durationMillis ? status.durationMillis / 1000 : 0,
    });

    if (status.didJustFinish) {
      onEnd?.();
    }
  };

  const togglePlay = async () => {
    if (!videoRef.current) return;
    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const seek = async (seconds: number) => {
    if (!videoRef.current) return;
    const newPosition = Math.max(0, Math.min(position + seconds, duration));
    await videoRef.current.setPositionAsync(newPosition * 1000);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const seekTo = async (pos: number) => {
    if (!videoRef.current) return;
    await videoRef.current.setPositionAsync(pos * 1000);
  };

  const changeSpeed = async (speed: PlaybackSpeed) => {
    if (!videoRef.current) return;
    await videoRef.current.setRateAsync(speed, true);
    setPlaybackSpeed(speed);
    setShowSpeedMenu(false);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const toggleMute = async () => {
    if (!videoRef.current) return;
    await videoRef.current.setIsMutedAsync(!isMuted);
    setIsMuted(!isMuted);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleClose = async () => {
    await MediaPlayerService.savePosition(source.id, position);
    await unlockOrientation();
    onClose?.();
  };

  const singleTap = Gesture.Tap()
    .onEnd(() => {
      runOnJS(toggleControls)();
    });

  const doubleTapLeft = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((event) => {
      if (event.x < screenWidth / 3) {
        runOnJS(seek)(-SEEK_TIME);
        runOnJS(setSeekIndicator)({ show: true, direction: 'backward', seconds: SEEK_TIME });
        doubleTapScale.value = withSpring(1.2, {}, () => {
          doubleTapScale.value = withSpring(1);
        });
        setTimeout(() => runOnJS(setSeekIndicator)({ show: false, direction: 'backward', seconds: 0 }), 800);
      }
    });

  const doubleTapRight = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(250)
    .onEnd((event) => {
      if (event.x > (screenWidth * 2) / 3) {
        runOnJS(seek)(SEEK_TIME);
        runOnJS(setSeekIndicator)({ show: true, direction: 'forward', seconds: SEEK_TIME });
        doubleTapScale.value = withSpring(1.2, {}, () => {
          doubleTapScale.value = withSpring(1);
        });
        setTimeout(() => runOnJS(setSeekIndicator)({ show: false, direction: 'forward', seconds: 0 }), 800);
      }
    });

  const verticalPanLeft = Gesture.Pan()
    .onUpdate((event) => {
      if (event.x < screenWidth / 3) {
        const delta = -event.velocityY / 50000;
        const newBrightness = Math.max(0, Math.min(1, brightness + delta));
        runOnJS(setBrightness)(newBrightness);
        runOnJS(setShowBrightnessIndicator)(true);
        if (Platform.OS !== 'web') {
          Brightness.setBrightnessAsync(newBrightness);
        }
      }
    })
    .onEnd(() => {
      runOnJS(setShowBrightnessIndicator)(false);
    });

  const verticalPanRight = Gesture.Pan()
    .onUpdate((event) => {
      if (event.x > (screenWidth * 2) / 3) {
        const delta = -event.velocityY / 50000;
        const newVolume = Math.max(0, Math.min(1, volume + delta));
        runOnJS(setVolume)(newVolume);
        runOnJS(setShowVolumeIndicator)(true);
        if (videoRef.current) {
          videoRef.current.setVolumeAsync(newVolume);
        }
      }
    })
    .onEnd(() => {
      runOnJS(setShowVolumeIndicator)(false);
    });

  const composed = Gesture.Race(
    Gesture.Exclusive(doubleTapLeft, doubleTapRight, singleTap),
    verticalPanLeft,
    verticalPanRight
  );

  const controlsAnimatedStyle = useAnimatedStyle(() => ({
    opacity: controlsOpacity.value,
  }));

  const formatTime = (seconds: number) => MediaPlayerService.formatDuration(seconds);

  return (
    <Modal
      visible={true}
      animationType="fade"
      supportedOrientations={['landscape']}
      onRequestClose={handleClose}
    >
      <StatusBar hidden />
      <GestureHandlerRootView style={styles.container}>
        <View style={[styles.container, { backgroundColor: '#000' }]}>
          <GestureDetector gesture={composed}>
            <View style={styles.videoContainer}>
              <Video
                ref={videoRef}
                source={{ uri: source.uri }}
                style={styles.video}
                resizeMode={ResizeMode.CONTAIN}
                shouldPlay={autoPlay}
                isLooping={false}
                isMuted={isMuted}
                volume={volume}
                rate={playbackSpeed}
                onPlaybackStatusUpdate={onPlaybackStatusUpdate}
                positionMillis={initialPosition * 1000}
              />

              {isBuffering && (
                <View style={styles.bufferingOverlay}>
                  <ActivityIndicator size="large" color={accentColor} />
                </View>
              )}

              {currentCue && (
                <View style={[styles.subtitleContainer, { bottom: showControls ? 100 : 40 }]}>
                  <View style={styles.subtitleBackground}>
                    <ThemedText style={styles.subtitleText}>{currentCue.text}</ThemedText>
                  </View>
                </View>
              )}

              {seekIndicator.show && (
                <View style={[styles.seekIndicator, seekIndicator.direction === 'backward' ? styles.seekIndicatorLeft : styles.seekIndicatorRight]}>
                  <Feather name={seekIndicator.direction === 'forward' ? 'fast-forward' : 'rewind'} size={40} color="#FFF" />
                  <ThemedText style={styles.seekIndicatorText}>{seekIndicator.seconds}s</ThemedText>
                </View>
              )}

              {showBrightnessIndicator && (
                <View style={styles.indicatorContainer}>
                  <Feather name="sun" size={24} color="#FFF" />
                  <View style={styles.indicatorBar}>
                    <View style={[styles.indicatorFill, { width: `${brightness * 100}%` }]} />
                  </View>
                </View>
              )}

              {showVolumeIndicator && (
                <View style={styles.indicatorContainer}>
                  <Feather name={volume === 0 ? 'volume-x' : volume < 0.5 ? 'volume-1' : 'volume-2'} size={24} color="#FFF" />
                  <View style={styles.indicatorBar}>
                    <View style={[styles.indicatorFill, { width: `${volume * 100}%` }]} />
                  </View>
                </View>
              )}

              <Animated.View style={[styles.controlsOverlay, controlsAnimatedStyle]} pointerEvents={showControls ? 'auto' : 'none'}>
                <View style={[styles.topBar, { paddingTop: insets.top + 10 }]}>
                  <Pressable onPress={handleClose} style={styles.topButton}>
                    <Feather name="x" size={28} color="#FFF" />
                  </Pressable>
                  <View style={styles.topTitle}>
                    <ThemedText style={styles.titleText} numberOfLines={1}>{source.name}</ThemedText>
                  </View>
                  <View style={styles.topButtons}>
                    <Pressable onPress={() => setShowSubtitleMenu(!showSubtitleMenu)} style={styles.topButton}>
                      <Feather name="message-square" size={24} color={currentSubtitle ? accentColor : '#FFF'} />
                    </Pressable>
                    <Pressable onPress={() => setShowSpeedMenu(!showSpeedMenu)} style={styles.topButton}>
                      <ThemedText style={styles.speedText}>{playbackSpeed}x</ThemedText>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.centerControls}>
                  <Pressable onPress={() => seek(-SEEK_TIME)} style={styles.controlButton}>
                    <Feather name="rewind" size={36} color="#FFF" />
                  </Pressable>
                  <Pressable onPress={togglePlay} style={styles.playButton}>
                    <Feather name={isPlaying ? 'pause' : 'play'} size={48} color="#FFF" />
                  </Pressable>
                  <Pressable onPress={() => seek(SEEK_TIME)} style={styles.controlButton}>
                    <Feather name="fast-forward" size={36} color="#FFF" />
                  </Pressable>
                </View>

                <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 10 }]}>
                  <ThemedText style={styles.timeText}>{formatTime(position)}</ThemedText>
                  <View style={styles.progressContainer}>
                    <Pressable
                      style={styles.progressBar}
                      onPress={(e) => {
                        const { locationX } = e.nativeEvent;
                        const progress = locationX / (screenWidth - 160);
                        seekTo(progress * duration);
                      }}
                    >
                      <View style={styles.progressTrack}>
                        <View style={[styles.progressFill, { width: `${(position / duration) * 100}%`, backgroundColor: accentColor }]} />
                        <View style={[styles.progressThumb, { left: `${(position / duration) * 100}%`, backgroundColor: accentColor }]} />
                      </View>
                    </Pressable>
                  </View>
                  <ThemedText style={styles.timeText}>{formatTime(duration)}</ThemedText>
                  <Pressable onPress={toggleMute} style={styles.volumeButton}>
                    <Feather name={isMuted ? 'volume-x' : 'volume-2'} size={24} color="#FFF" />
                  </Pressable>
                </View>
              </Animated.View>

              {showSpeedMenu && (
                <View style={styles.menuOverlay}>
                  <Pressable style={styles.menuBackdrop} onPress={() => setShowSpeedMenu(false)} />
                  <View style={styles.speedMenu}>
                    <ThemedText style={styles.menuTitle}>Vitesse de lecture</ThemedText>
                    {PLAYBACK_SPEEDS.map((speed) => (
                      <Pressable
                        key={speed}
                        style={[styles.menuItem, playbackSpeed === speed && { backgroundColor: accentColor + '30' }]}
                        onPress={() => changeSpeed(speed)}
                      >
                        <ThemedText style={[styles.menuItemText, playbackSpeed === speed && { color: accentColor }]}>
                          {speed}x
                        </ThemedText>
                        {playbackSpeed === speed && <Feather name="check" size={20} color={accentColor} />}
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {showSubtitleMenu && (
                <View style={styles.menuOverlay}>
                  <Pressable style={styles.menuBackdrop} onPress={() => setShowSubtitleMenu(false)} />
                  <View style={styles.speedMenu}>
                    <ThemedText style={styles.menuTitle}>Sous-titres</ThemedText>
                    <Pressable
                      style={[styles.menuItem, !currentSubtitle && { backgroundColor: accentColor + '30' }]}
                      onPress={() => { setCurrentSubtitle(null); setShowSubtitleMenu(false); }}
                    >
                      <ThemedText style={[styles.menuItemText, !currentSubtitle && { color: accentColor }]}>
                        Desactives
                      </ThemedText>
                      {!currentSubtitle && <Feather name="check" size={20} color={accentColor} />}
                    </Pressable>
                    {subtitles.map((sub) => (
                      <Pressable
                        key={sub.id}
                        style={[styles.menuItem, currentSubtitle?.id === sub.id && { backgroundColor: accentColor + '30' }]}
                        onPress={() => { setCurrentSubtitle(sub); setShowSubtitleMenu(false); }}
                      >
                        <ThemedText style={[styles.menuItemText, currentSubtitle?.id === sub.id && { color: accentColor }]}>
                          {sub.label}
                        </ThemedText>
                        {currentSubtitle?.id === sub.id && <Feather name="check" size={20} color={accentColor} />}
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}
            </View>
          </GestureDetector>
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
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  bufferingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  controlsOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'space-between',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topButton: {
    padding: 8,
  },
  topTitle: {
    flex: 1,
    marginHorizontal: 16,
  },
  titleText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  topButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  speedText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  centerControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 60,
  },
  controlButton: {
    padding: 12,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: 30,
  },
  playButton: {
    padding: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 50,
  },
  bottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
    gap: 12,
  },
  timeText: {
    color: '#FFF',
    fontSize: 13,
    fontWeight: '500',
    minWidth: 50,
  },
  progressContainer: {
    flex: 1,
    height: 40,
    justifyContent: 'center',
  },
  progressBar: {
    height: 40,
    justifyContent: 'center',
  },
  progressTrack: {
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    position: 'relative',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  progressThumb: {
    position: 'absolute',
    top: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    marginLeft: -8,
  },
  volumeButton: {
    padding: 8,
  },
  subtitleContainer: {
    position: 'absolute',
    left: 20,
    right: 20,
    alignItems: 'center',
  },
  subtitleBackground: {
    backgroundColor: 'rgba(0,0,0,0.75)',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  subtitleText: {
    color: '#FFF',
    fontSize: 18,
    textAlign: 'center',
  },
  seekIndicator: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
    borderRadius: 60,
  },
  seekIndicatorLeft: {
    left: '15%',
  },
  seekIndicatorRight: {
    right: '15%',
  },
  seekIndicatorText: {
    color: '#FFF',
    fontSize: 14,
    marginTop: 4,
  },
  indicatorContainer: {
    position: 'absolute',
    top: '45%',
    left: '50%',
    marginLeft: -60,
    width: 120,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
  },
  indicatorBar: {
    width: '100%',
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    marginTop: 12,
    overflow: 'hidden',
  },
  indicatorFill: {
    height: '100%',
    backgroundColor: '#FFF',
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
    backgroundColor: '#1C1C1E',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
  },
  menuTitle: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'center',
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  menuItemText: {
    color: '#FFF',
    fontSize: 15,
  },
});
