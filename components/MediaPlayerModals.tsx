import { useMediaPlayer } from '@/contexts/MediaPlayerContext';
import { VideoPlayer, AudioPlayer, ImageViewer, PdfReader, DocumentViewer } from '@/components/players';

export default function MediaPlayerModals() {
  const {
    currentMedia,
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
    imageIndex,
    queue,
    updatePlaybackState,
  } = useMediaPlayer();

  return (
    <>
      {isVideoPlayerVisible && currentMedia && (
        <VideoPlayer
          source={currentMedia}
          onClose={() => {
            setVideoPlayerVisible(false);
            updatePlaybackState({ isPlaying: false });
          }}
          onEnd={() => {
            setVideoPlayerVisible(false);
            updatePlaybackState({ isPlaying: false });
          }}
          subtitles={currentMedia.subtitles}
        />
      )}

      {isAudioPlayerVisible && currentMedia && (
        <AudioPlayer
          source={currentMedia}
          queue={queue.items}
          onClose={() => {
            setAudioPlayerVisible(false);
            updatePlaybackState({ isPlaying: false });
          }}
          onEnd={() => {
            updatePlaybackState({ isPlaying: false });
          }}
        />
      )}

      {isImageViewerVisible && imageGallery.length > 0 && (
        <ImageViewer
          images={imageGallery}
          initialIndex={imageIndex}
          onClose={() => setImageViewerVisible(false)}
        />
      )}

      {isPdfReaderVisible && currentMedia && (
        <PdfReader
          source={currentMedia}
          onClose={() => setPdfReaderVisible(false)}
        />
      )}

      {isDocumentViewerVisible && currentMedia && (
        <DocumentViewer
          source={currentMedia}
          onClose={() => setDocumentViewerVisible(false)}
        />
      )}
    </>
  );
}
