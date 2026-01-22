import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import { MediaFile, PlaybackState, QueueState, RepeatMode, PlaybackSpeed } from '@/types/media';
import { MediaPlayerService } from '@/services/MediaPlayerService';

interface MediaPlayerContextType {
  currentMedia: MediaFile | null;
  setCurrentMedia: (media: MediaFile | null) => void;
  playbackState: PlaybackState;
  updatePlaybackState: (state: Partial<PlaybackState>) => void;
  queue: QueueState;
  setQueue: (items: MediaFile[], startIndex?: number) => void;
  addToQueue: (item: MediaFile) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  previous: () => void;
  skipTo: (index: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  isVideoPlayerVisible: boolean;
  setVideoPlayerVisible: (visible: boolean) => void;
  isAudioPlayerVisible: boolean;
  setAudioPlayerVisible: (visible: boolean) => void;
  isImageViewerVisible: boolean;
  setImageViewerVisible: (visible: boolean) => void;
  isPdfReaderVisible: boolean;
  setPdfReaderVisible: (visible: boolean) => void;
  isDocumentViewerVisible: boolean;
  setDocumentViewerVisible: (visible: boolean) => void;
  imageGallery: MediaFile[];
  setImageGallery: (images: MediaFile[]) => void;
  imageIndex: number;
  setImageIndex: (index: number) => void;
  openMedia: (file: MediaFile) => void;
  closeAllPlayers: () => void;
}

const defaultPlaybackState: PlaybackState = {
  isPlaying: false,
  isBuffering: false,
  position: 0,
  duration: 0,
  volume: 1,
  isMuted: false,
  playbackSpeed: 1,
  isFullscreen: false,
  isPiP: false,
};

const defaultQueueState: QueueState = {
  items: [],
  currentIndex: 0,
  repeatMode: 'off',
  shuffleMode: 'off',
};

const MediaPlayerContext = createContext<MediaPlayerContextType | undefined>(undefined);

export function MediaPlayerProvider({ children }: { children: ReactNode }) {
  const [currentMedia, setCurrentMedia] = useState<MediaFile | null>(null);
  const [playbackState, setPlaybackState] = useState<PlaybackState>(defaultPlaybackState);
  const [queue, setQueueState] = useState<QueueState>(defaultQueueState);

  const [isVideoPlayerVisible, setVideoPlayerVisible] = useState(false);
  const [isAudioPlayerVisible, setAudioPlayerVisible] = useState(false);
  const [isImageViewerVisible, setImageViewerVisible] = useState(false);
  const [isPdfReaderVisible, setPdfReaderVisible] = useState(false);
  const [isDocumentViewerVisible, setDocumentViewerVisible] = useState(false);

  const [imageGallery, setImageGallery] = useState<MediaFile[]>([]);
  const [imageIndex, setImageIndex] = useState(0);

  const updatePlaybackState = useCallback((state: Partial<PlaybackState>) => {
    setPlaybackState(prev => ({ ...prev, ...state }));
  }, []);

  const setQueue = useCallback((items: MediaFile[], startIndex = 0) => {
    setQueueState(prev => ({
      ...prev,
      items,
      currentIndex: startIndex,
    }));
    if (items.length > 0 && items[startIndex]) {
      setCurrentMedia(items[startIndex]);
    }
  }, []);

  const addToQueue = useCallback((item: MediaFile) => {
    setQueueState(prev => ({
      ...prev,
      items: [...prev.items, item],
    }));
  }, []);

  const removeFromQueue = useCallback((index: number) => {
    setQueueState(prev => {
      const newItems = prev.items.filter((_, i) => i !== index);
      let newIndex = prev.currentIndex;
      if (index < prev.currentIndex) {
        newIndex = Math.max(0, prev.currentIndex - 1);
      } else if (index === prev.currentIndex && index >= newItems.length) {
        newIndex = Math.max(0, newItems.length - 1);
      }
      return { ...prev, items: newItems, currentIndex: newIndex };
    });
  }, []);

  const clearQueue = useCallback(() => {
    setQueueState(prev => ({
      ...prev,
      items: [],
      currentIndex: 0,
    }));
  }, []);

  const next = useCallback(() => {
    setQueueState(prev => {
      if (prev.items.length === 0) return prev;

      let nextIndex: number;
      if (prev.shuffleMode === 'on') {
        nextIndex = Math.floor(Math.random() * prev.items.length);
      } else {
        nextIndex = prev.currentIndex + 1;
        if (nextIndex >= prev.items.length) {
          if (prev.repeatMode === 'all') {
            nextIndex = 0;
          } else {
            return prev;
          }
        }
      }

      setCurrentMedia(prev.items[nextIndex]);
      return { ...prev, currentIndex: nextIndex };
    });
  }, []);

  const previous = useCallback(() => {
    setQueueState(prev => {
      if (prev.items.length === 0) return prev;

      let prevIndex = prev.currentIndex - 1;
      if (prevIndex < 0) {
        if (prev.repeatMode === 'all') {
          prevIndex = prev.items.length - 1;
        } else {
          prevIndex = 0;
        }
      }

      setCurrentMedia(prev.items[prevIndex]);
      return { ...prev, currentIndex: prevIndex };
    });
  }, []);

  const skipTo = useCallback((index: number) => {
    setQueueState(prev => {
      if (index < 0 || index >= prev.items.length) return prev;
      setCurrentMedia(prev.items[index]);
      return { ...prev, currentIndex: index };
    });
  }, []);

  const setRepeatMode = useCallback((mode: RepeatMode) => {
    setQueueState(prev => ({ ...prev, repeatMode: mode }));
  }, []);

  const toggleShuffle = useCallback(() => {
    setQueueState(prev => ({
      ...prev,
      shuffleMode: prev.shuffleMode === 'off' ? 'on' : 'off',
    }));
  }, []);

  const closeAllPlayers = useCallback(() => {
    setVideoPlayerVisible(false);
    setAudioPlayerVisible(false);
    setImageViewerVisible(false);
    setPdfReaderVisible(false);
    setDocumentViewerVisible(false);
    updatePlaybackState({ isPlaying: false });
  }, [updatePlaybackState]);

  const openMedia = useCallback((file: MediaFile) => {
    closeAllPlayers();
    setCurrentMedia(file);

    switch (file.type) {
      case 'video':
        setVideoPlayerVisible(true);
        break;
      case 'audio':
        setAudioPlayerVisible(true);
        break;
      case 'image':
        setImageGallery([file]);
        setImageIndex(0);
        setImageViewerVisible(true);
        break;
      case 'pdf':
        setPdfReaderVisible(true);
        break;
      case 'document':
        setDocumentViewerVisible(true);
        break;
    }
  }, [closeAllPlayers]);

  useEffect(() => {
    const unsubscribeVideo = MediaPlayerService.registerListener('video', (file) => {
      closeAllPlayers();
      setCurrentMedia(file);
      setVideoPlayerVisible(true);
    });

    const unsubscribeAudio = MediaPlayerService.registerListener('audio', (file) => {
      closeAllPlayers();
      setCurrentMedia(file);
      setAudioPlayerVisible(true);
    });

    const unsubscribeImage = MediaPlayerService.registerListener('image', (file) => {
      closeAllPlayers();
      setCurrentMedia(file);
      setImageGallery([file]);
      setImageIndex(0);
      setImageViewerVisible(true);
    });

    const unsubscribePdf = MediaPlayerService.registerListener('pdf', (file) => {
      closeAllPlayers();
      setCurrentMedia(file);
      setPdfReaderVisible(true);
    });

    const unsubscribeDocument = MediaPlayerService.registerListener('document', (file) => {
      closeAllPlayers();
      setCurrentMedia(file);
      setDocumentViewerVisible(true);
    });

    return () => {
      unsubscribeVideo();
      unsubscribeAudio();
      unsubscribeImage();
      unsubscribePdf();
      unsubscribeDocument();
    };
  }, [closeAllPlayers]);

  return (
    <MediaPlayerContext.Provider
      value={{
        currentMedia,
        setCurrentMedia,
        playbackState,
        updatePlaybackState,
        queue,
        setQueue,
        addToQueue,
        removeFromQueue,
        clearQueue,
        next,
        previous,
        skipTo,
        setRepeatMode,
        toggleShuffle,
        isVideoPlayerVisible,
        setVideoPlayerVisible,
        isAudioPlayerVisible,
        setAudioPlayerVisible,
        isImageViewerVisible,
        setImageViewerVisible,
        isPdfReaderVisible,
        setPdfReaderVisible,
        isDocumentViewerVisible,
        setDocumentViewerVisible,
        imageGallery,
        setImageGallery,
        imageIndex,
        setImageIndex,
        openMedia,
        closeAllPlayers,
      }}
    >
      {children}
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  if (!context) {
    throw new Error('useMediaPlayer must be used within a MediaPlayerProvider');
  }
  return context;
}
