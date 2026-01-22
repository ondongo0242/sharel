export type MediaType = 'video' | 'audio' | 'image' | 'pdf' | 'document';

export type SubtitleTrack = {
  id: string;
  label: string;
  language: string;
  uri: string;
  format: 'srt' | 'vtt' | 'ass';
};

export type SubtitleCue = {
  id: string;
  startTime: number;
  endTime: number;
  text: string;
};

export type AudioTrack = {
  id: string;
  label: string;
  language: string;
};

export type PlaybackSpeed = 0.25 | 0.5 | 0.75 | 1 | 1.25 | 1.5 | 1.75 | 2;

export type RepeatMode = 'off' | 'one' | 'all';

export type ShuffleMode = 'off' | 'on';

export interface MediaFile {
  id: string;
  uri: string;
  name: string;
  type: MediaType;
  mimeType: string;
  size: number;
  duration?: number;
  thumbnail?: string;
  metadata?: MediaMetadata;
  subtitles?: SubtitleTrack[];
}

export interface MediaMetadata {
  title?: string;
  artist?: string;
  album?: string;
  albumArt?: string;
  year?: number;
  genre?: string;
  bitrate?: number;
  sampleRate?: number;
  channels?: number;
  width?: number;
  height?: number;
  fps?: number;
  codec?: string;
  duration?: number;
  exif?: ExifData;
}

export interface ExifData {
  make?: string;
  model?: string;
  dateTime?: string;
  exposureTime?: string;
  fNumber?: number;
  iso?: number;
  focalLength?: number;
  gpsLatitude?: number;
  gpsLongitude?: number;
}

export interface PlaybackState {
  isPlaying: boolean;
  isBuffering: boolean;
  position: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackSpeed: PlaybackSpeed;
  isFullscreen: boolean;
  isPiP: boolean;
}

export interface PlayerControls {
  play: () => void;
  pause: () => void;
  toggle: () => void;
  seek: (position: number) => void;
  seekForward: (seconds?: number) => void;
  seekBackward: (seconds?: number) => void;
  setVolume: (volume: number) => void;
  toggleMute: () => void;
  setPlaybackSpeed: (speed: PlaybackSpeed) => void;
  enterFullscreen: () => void;
  exitFullscreen: () => void;
  toggleFullscreen: () => void;
  enterPiP: () => void;
  exitPiP: () => void;
}

export interface QueueState {
  items: MediaFile[];
  currentIndex: number;
  repeatMode: RepeatMode;
  shuffleMode: ShuffleMode;
}

export interface QueueControls {
  setQueue: (items: MediaFile[], startIndex?: number) => void;
  addToQueue: (item: MediaFile) => void;
  removeFromQueue: (index: number) => void;
  clearQueue: () => void;
  next: () => void;
  previous: () => void;
  skipTo: (index: number) => void;
  setRepeatMode: (mode: RepeatMode) => void;
  toggleShuffle: () => void;
  reorder: (fromIndex: number, toIndex: number) => void;
}

export interface VideoPlayerProps {
  source: MediaFile;
  autoPlay?: boolean;
  showControls?: boolean;
  onClose?: () => void;
  onEnd?: () => void;
  subtitles?: SubtitleTrack[];
  initialPosition?: number;
}

export interface AudioPlayerProps {
  source: MediaFile;
  queue?: MediaFile[];
  autoPlay?: boolean;
  onClose?: () => void;
  onEnd?: () => void;
  showMiniPlayer?: boolean;
}

export interface ImageViewerProps {
  images: MediaFile[];
  initialIndex?: number;
  onClose?: () => void;
  showInfo?: boolean;
}

export interface PdfReaderProps {
  source: MediaFile;
  initialPage?: number;
  onClose?: () => void;
}

export interface DocumentViewerProps {
  source: MediaFile;
  onClose?: () => void;
}

export const SUPPORTED_FORMATS = {
  video: ['.mp4', '.mkv', '.avi', '.mov', '.webm', '.m4v', '.3gp', '.wmv', '.flv'],
  audio: ['.mp3', '.flac', '.wav', '.aac', '.ogg', '.m4a', '.wma', '.opus', '.aiff'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.heic', '.heif', '.bmp', '.tiff', '.svg'],
  pdf: ['.pdf'],
  document: ['.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.txt', '.rtf', '.odt', '.ods', '.odp'],
  subtitle: ['.srt', '.vtt', '.ass', '.ssa'],
};

export const getMediaType = (filename: string): MediaType | null => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  if (SUPPORTED_FORMATS.video.includes(ext)) return 'video';
  if (SUPPORTED_FORMATS.audio.includes(ext)) return 'audio';
  if (SUPPORTED_FORMATS.image.includes(ext)) return 'image';
  if (SUPPORTED_FORMATS.pdf.includes(ext)) return 'pdf';
  if (SUPPORTED_FORMATS.document.includes(ext)) return 'document';
  
  return null;
};

export const getMimeType = (filename: string): string => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  
  const mimeTypes: Record<string, string> = {
    '.mp4': 'video/mp4',
    '.mkv': 'video/x-matroska',
    '.avi': 'video/x-msvideo',
    '.mov': 'video/quicktime',
    '.webm': 'video/webm',
    '.mp3': 'audio/mpeg',
    '.flac': 'audio/flac',
    '.wav': 'audio/wav',
    '.aac': 'audio/aac',
    '.ogg': 'audio/ogg',
    '.m4a': 'audio/mp4',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.ppt': 'application/vnd.ms-powerpoint',
    '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    '.txt': 'text/plain',
  };
  
  return mimeTypes[ext] || 'application/octet-stream';
};
