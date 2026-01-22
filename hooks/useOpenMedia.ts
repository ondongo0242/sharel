import { useCallback } from 'react';
import { useMediaPlayer } from '@/contexts/MediaPlayerContext';
import { MediaPlayerService } from '@/services/MediaPlayerService';
import { MediaFile, getMediaType, getMimeType } from '@/types/media';

interface OpenMediaOptions {
  uri: string;
  name: string;
  size?: number;
  thumbnail?: string;
  metadata?: MediaFile['metadata'];
  subtitles?: MediaFile['subtitles'];
}

export function useOpenMedia() {
  const { openMedia, setImageGallery, setImageIndex, setQueue } = useMediaPlayer();

  const open = useCallback((options: OpenMediaOptions) => {
    const type = getMediaType(options.name);
    if (!type) {
      console.warn('Unsupported file type:', options.name);
      return;
    }

    const file: MediaFile = {
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: options.uri,
      name: options.name,
      type,
      mimeType: getMimeType(options.name),
      size: options.size || 0,
      thumbnail: options.thumbnail,
      metadata: options.metadata,
      subtitles: options.subtitles,
    };

    openMedia(file);
  }, [openMedia]);

  const openImage = useCallback((image: OpenMediaOptions, allImages?: OpenMediaOptions[], currentIndex?: number) => {
    const createMediaFile = (opt: OpenMediaOptions): MediaFile => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: opt.uri,
      name: opt.name,
      type: 'image',
      mimeType: getMimeType(opt.name),
      size: opt.size || 0,
      thumbnail: opt.thumbnail,
      metadata: opt.metadata,
    });

    if (allImages && allImages.length > 0) {
      const gallery = allImages.map(createMediaFile);
      setImageGallery(gallery);
      setImageIndex(currentIndex || 0);
    } else {
      setImageGallery([createMediaFile(image)]);
      setImageIndex(0);
    }

    openMedia(createMediaFile(image));
  }, [openMedia, setImageGallery, setImageIndex]);

  const openAudio = useCallback((audio: OpenMediaOptions, queue?: OpenMediaOptions[], startIndex?: number) => {
    const createMediaFile = (opt: OpenMediaOptions): MediaFile => ({
      id: `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      uri: opt.uri,
      name: opt.name,
      type: 'audio',
      mimeType: getMimeType(opt.name),
      size: opt.size || 0,
      metadata: opt.metadata,
    });

    const file = createMediaFile(audio);

    if (queue && queue.length > 0) {
      const queueFiles = queue.map(createMediaFile);
      setQueue(queueFiles, startIndex || 0);
    }

    openMedia(file);
  }, [openMedia, setQueue]);

  const openFromUri = useCallback((uri: string, name?: string) => {
    const filename = name || uri.split('/').pop() || 'file';
    open({ uri, name: filename });
  }, [open]);

  return {
    open,
    openImage,
    openAudio,
    openFromUri,
  };
}
