import { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  Platform,
  Dimensions,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import * as FileSystem from 'expo-file-system';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import { MediaPlayerService } from '@/services/MediaPlayerService';
import type { DocumentViewerProps } from '@/types/media';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

type DocumentType = 'word' | 'excel' | 'powerpoint' | 'text' | 'unknown';

const getDocumentType = (filename: string): DocumentType => {
  const ext = filename.toLowerCase().substring(filename.lastIndexOf('.'));
  if (['.doc', '.docx', '.odt', '.rtf'].includes(ext)) return 'word';
  if (['.xls', '.xlsx', '.ods', '.csv'].includes(ext)) return 'excel';
  if (['.ppt', '.pptx', '.odp'].includes(ext)) return 'powerpoint';
  if (['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts'].includes(ext)) return 'text';
  return 'unknown';
};

const getDocumentIcon = (type: DocumentType): string => {
  switch (type) {
    case 'word': return 'file-text';
    case 'excel': return 'grid';
    case 'powerpoint': return 'monitor';
    case 'text': return 'file';
    default: return 'file';
  }
};

const getDocumentColor = (type: DocumentType): string => {
  switch (type) {
    case 'word': return '#2B579A';
    case 'excel': return '#217346';
    case 'powerpoint': return '#D24726';
    case 'text': return '#6B7280';
    default: return '#6B7280';
  }
};

export default function DocumentViewer({ source, onClose }: DocumentViewerProps) {
  const { theme, isDark, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [textContent, setTextContent] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);

  const documentType = getDocumentType(source.name);
  const documentIcon = getDocumentIcon(documentType);
  const documentColor = getDocumentColor(documentType);

  useEffect(() => {
    loadDocument();
  }, [source.uri]);

  const loadDocument = async () => {
    try {
      setIsLoading(true);
      setError(null);

      if (documentType === 'text') {
        const content = await FileSystem.readAsStringAsync(source.uri);
        setTextContent(content);
        setIsLoading(false);
        return;
      }

      setIsLoading(false);
    } catch (err) {
      console.error('Error loading document:', err);
      setError('Impossible de charger le document');
      setIsLoading(false);
    }
  };

  const handleShare = async () => {
    try {
      if (Platform.OS !== 'web') {
        const available = await Sharing.isAvailableAsync();
        if (available) {
          await Sharing.shareAsync(source.uri);
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      }
    } catch (error) {
      console.error('Error sharing:', error);
    }
  };

  const zoomIn = () => {
    setZoom(Math.min(zoom + 0.25, 3));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const zoomOut = () => {
    setZoom(Math.max(zoom - 0.25, 0.5));
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const getViewerUrl = () => {
    if (source.uri.startsWith('http')) {
      return `https://docs.google.com/viewer?url=${encodeURIComponent(source.uri)}&embedded=true`;
    }
    return `https://docs.google.com/viewer?embedded=true`;
  };

  const officeViewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          width: 100%; 
          height: 100%; 
          background: ${isDark ? '#1C1C1E' : '#F2F2F7'};
          overflow: hidden;
        }
        iframe {
          width: 100%;
          height: 100%;
          border: none;
        }
        .error-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          height: 100%;
          padding: 40px;
          text-align: center;
        }
        .error-icon {
          font-size: 64px;
          margin-bottom: 20px;
          color: ${documentColor};
        }
        .error-title {
          font-size: 20px;
          font-weight: 600;
          color: ${isDark ? '#FFF' : '#000'};
          margin-bottom: 12px;
        }
        .error-message {
          font-size: 15px;
          color: ${isDark ? '#8E8E93' : '#6B7280'};
          line-height: 1.5;
        }
      </style>
    </head>
    <body>
      <iframe src="${getViewerUrl()}" allowfullscreen></iframe>
    </body>
    </html>
  `;

  const renderTextViewer = () => (
    <ScrollView 
      style={styles.textContainer}
      contentContainerStyle={[styles.textContent, { transform: [{ scale: zoom }] }]}
    >
      <ThemedText style={[styles.textViewerContent, { color: theme.text }]}>
        {textContent}
      </ThemedText>
    </ScrollView>
  );

  const renderOfficeViewer = () => (
    <WebView
      ref={webViewRef}
      source={{ html: officeViewerHtml }}
      style={[styles.webview, { transform: [{ scale: zoom }] }]}
      javaScriptEnabled
      domStorageEnabled
      allowFileAccess
      mixedContentMode="compatibility"
      originWhitelist={['*']}
      onLoadStart={() => setIsLoading(true)}
      onLoadEnd={() => setIsLoading(false)}
      onError={() => setError('Erreur de chargement du document')}
    />
  );

  const renderFallback = () => (
    <View style={styles.fallbackContainer}>
      <View style={[styles.fallbackIcon, { backgroundColor: documentColor + '20' }]}>
        <Feather name={documentIcon as any} size={64} color={documentColor} />
      </View>
      <ThemedText style={[styles.fallbackTitle, { color: theme.text }]}>
        {source.name}
      </ThemedText>
      <ThemedText style={[styles.fallbackSubtitle, { color: theme.textSecondary }]}>
        {MediaPlayerService.formatFileSize(source.size)}
      </ThemedText>
      <ThemedText style={[styles.fallbackMessage, { color: theme.textSecondary }]}>
        Ce type de fichier necessite une application externe pour etre visualise.
      </ThemedText>
      <Pressable 
        style={[styles.shareButton, { backgroundColor: accentColor }]}
        onPress={handleShare}
      >
        <Feather name="share" size={20} color="#FFF" />
        <ThemedText style={styles.shareButtonText}>Ouvrir avec...</ThemedText>
      </Pressable>
    </View>
  );

  return (
    <Modal visible={true} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: isDark ? '#1C1C1E' : '#F2F2F7' }]}>
        <View style={[styles.header, { paddingTop: insets.top, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <Feather name="x" size={24} color={theme.text} />
          </Pressable>
          
          <View style={styles.headerTitle}>
            <View style={[styles.docTypeIcon, { backgroundColor: documentColor + '20' }]}>
              <Feather name={documentIcon as any} size={16} color={documentColor} />
            </View>
            <ThemedText style={[styles.headerTitleText, { color: theme.text }]} numberOfLines={1}>
              {source.name}
            </ThemedText>
          </View>
          
          <Pressable onPress={handleShare} style={styles.headerButton}>
            <Feather name="share" size={22} color={theme.text} />
          </Pressable>
        </View>

        <View style={styles.content}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={accentColor} />
              <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                Chargement...
              </ThemedText>
            </View>
          )}

          {error ? (
            <View style={styles.errorContainer}>
              <Feather name="alert-circle" size={48} color="#FF3B30" />
              <ThemedText style={[styles.errorText, { color: theme.text }]}>
                {error}
              </ThemedText>
              <Pressable 
                style={[styles.retryButton, { borderColor: accentColor }]}
                onPress={loadDocument}
              >
                <ThemedText style={{ color: accentColor }}>Reessayer</ThemedText>
              </Pressable>
            </View>
          ) : documentType === 'text' && textContent ? (
            renderTextViewer()
          ) : documentType !== 'unknown' && Platform.OS !== 'web' ? (
            renderOfficeViewer()
          ) : (
            renderFallback()
          )}
        </View>

        <View style={[styles.toolbar, { paddingBottom: insets.bottom + 10, backgroundColor: isDark ? '#2C2C2E' : '#FFFFFF' }]}>
          <Pressable onPress={zoomOut} style={styles.toolbarButton}>
            <Feather name="zoom-out" size={22} color={theme.text} />
          </Pressable>
          <ThemedText style={[styles.zoomText, { color: theme.text }]}>
            {Math.round(zoom * 100)}%
          </ThemedText>
          <Pressable onPress={zoomIn} style={styles.toolbarButton}>
            <Feather name="zoom-in" size={22} color={theme.text} />
          </Pressable>
          
          <View style={styles.spacer} />
          
          <View style={styles.docInfo}>
            <ThemedText style={[styles.docInfoText, { color: theme.textSecondary }]}>
              {documentType.toUpperCase()}
            </ThemedText>
            <ThemedText style={[styles.docInfoText, { color: theme.textSecondary }]}>
              {MediaPlayerService.formatFileSize(source.size)}
            </ThemedText>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  headerButton: {
    padding: 10,
  },
  headerTitle: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    gap: 10,
  },
  docTypeIcon: {
    width: 28,
    height: 28,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitleText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  webview: {
    flex: 1,
  },
  textContainer: {
    flex: 1,
  },
  textContent: {
    padding: 20,
  },
  textViewerContent: {
    fontSize: 14,
    lineHeight: 22,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    zIndex: 10,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  errorText: {
    fontSize: 16,
    marginTop: 16,
    marginBottom: 20,
    textAlign: 'center',
  },
  retryButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 8,
    borderWidth: 1,
  },
  fallbackContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  fallbackIcon: {
    width: 120,
    height: 120,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  fallbackTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  fallbackSubtitle: {
    fontSize: 14,
    marginBottom: 20,
  },
  fallbackMessage: {
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 10,
  },
  shareButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  toolbarButton: {
    padding: 10,
  },
  zoomText: {
    fontSize: 14,
    fontWeight: '500',
    minWidth: 50,
    textAlign: 'center',
  },
  spacer: {
    flex: 1,
  },
  docInfo: {
    flexDirection: 'row',
    gap: 12,
  },
  docInfoText: {
    fontSize: 12,
  },
});
