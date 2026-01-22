import { useState, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Pressable,
  Modal,
  TextInput,
  Platform,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { WebView } from 'react-native-webview';
import { Feather } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ThemedText } from '@/components/ThemedText';
import { useTheme } from '@/hooks/useTheme';
import type { PdfReaderProps } from '@/types/media';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const BOOKMARK_STORAGE_KEY = '@pdf_bookmarks_';

interface Bookmark {
  page: number;
  title: string;
  timestamp: number;
}

export default function PdfReader({ source, initialPage = 1, onClose }: PdfReaderProps) {
  const { theme, isDark, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const webViewRef = useRef<WebView>(null);

  const [currentPage, setCurrentPage] = useState(initialPage);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [showControls, setShowControls] = useState(true);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [nightMode, setNightMode] = useState(isDark);
  const [showBookmarks, setShowBookmarks] = useState(false);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [showPageInput, setShowPageInput] = useState(false);
  const [pageInputValue, setPageInputValue] = useState('');

  const loadBookmarks = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(BOOKMARK_STORAGE_KEY + source.id);
      if (stored) {
        setBookmarks(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading bookmarks:', error);
    }
  }, [source.id]);

  const saveBookmarks = useCallback(async (newBookmarks: Bookmark[]) => {
    try {
      await AsyncStorage.setItem(BOOKMARK_STORAGE_KEY + source.id, JSON.stringify(newBookmarks));
    } catch (error) {
      console.error('Error saving bookmarks:', error);
    }
  }, [source.id]);

  const addBookmark = useCallback(() => {
    const existing = bookmarks.find(b => b.page === currentPage);
    if (existing) return;

    const newBookmark: Bookmark = {
      page: currentPage,
      title: `Page ${currentPage}`,
      timestamp: Date.now(),
    };
    const newBookmarks = [...bookmarks, newBookmark].sort((a, b) => a.page - b.page);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [bookmarks, currentPage, saveBookmarks]);

  const removeBookmark = useCallback((page: number) => {
    const newBookmarks = bookmarks.filter(b => b.page !== page);
    setBookmarks(newBookmarks);
    saveBookmarks(newBookmarks);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [bookmarks, saveBookmarks]);

  const goToPage = useCallback((page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    webViewRef.current?.injectJavaScript(`goToPage(${page}); true;`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [totalPages]);

  const handleSearch = useCallback((query: string) => {
    setSearchQuery(query);
    if (query.trim()) {
      webViewRef.current?.injectJavaScript(`searchText("${query.replace(/"/g, '\\"')}"); true;`);
    }
  }, []);

  const zoomIn = useCallback(() => {
    const newZoom = Math.min(zoom + 0.25, 3);
    setZoom(newZoom);
    webViewRef.current?.injectJavaScript(`setZoom(${newZoom}); true;`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [zoom]);

  const zoomOut = useCallback(() => {
    const newZoom = Math.max(zoom - 0.25, 0.5);
    setZoom(newZoom);
    webViewRef.current?.injectJavaScript(`setZoom(${newZoom}); true;`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [zoom]);

  const toggleNightMode = useCallback(() => {
    setNightMode(!nightMode);
    webViewRef.current?.injectJavaScript(`toggleNightMode(${!nightMode}); true;`);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }, [nightMode]);

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

  const handleMessage = (event: any) => {
    try {
      const data = JSON.parse(event.nativeEvent.data);
      if (data.type === 'pageChange') {
        setCurrentPage(data.page);
      } else if (data.type === 'totalPages') {
        setTotalPages(data.total);
        setIsLoading(false);
      } else if (data.type === 'loaded') {
        setIsLoading(false);
        loadBookmarks();
      }
    } catch (error) {}
  };

  const pdfViewerHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
      <script src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js"></script>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html, body { 
          width: 100%; 
          height: 100%; 
          overflow: hidden;
          background: ${nightMode ? '#1C1C1E' : '#F2F2F7'};
        }
        #viewer {
          width: 100%;
          height: 100%;
          overflow: auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 10px;
        }
        .page-container {
          margin-bottom: 10px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15);
          background: white;
        }
        canvas {
          display: block;
          max-width: 100%;
        }
        .night-mode canvas {
          filter: invert(0.9) hue-rotate(180deg);
        }
        .highlight {
          background-color: yellow;
          color: black;
        }
      </style>
    </head>
    <body class="${nightMode ? 'night-mode' : ''}">
      <div id="viewer"></div>
      <script>
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        
        let pdfDoc = null;
        let currentZoom = 1;
        let pageRendering = false;
        let pageNumPending = null;
        
        async function loadPDF() {
          try {
            const loadingTask = pdfjsLib.getDocument('${source.uri}');
            pdfDoc = await loadingTask.promise;
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'totalPages',
              total: pdfDoc.numPages
            }));
            
            for (let i = 1; i <= pdfDoc.numPages; i++) {
              await renderPage(i);
            }
            
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'loaded'
            }));
          } catch (error) {
            console.error('Error loading PDF:', error);
          }
        }
        
        async function renderPage(num) {
          const page = await pdfDoc.getPage(num);
          const scale = currentZoom * (window.devicePixelRatio || 1);
          const viewport = page.getViewport({ scale });
          
          const container = document.createElement('div');
          container.className = 'page-container';
          container.id = 'page-' + num;
          
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          canvas.height = viewport.height;
          canvas.width = viewport.width;
          canvas.style.width = (viewport.width / (window.devicePixelRatio || 1)) + 'px';
          canvas.style.height = (viewport.height / (window.devicePixelRatio || 1)) + 'px';
          
          container.appendChild(canvas);
          document.getElementById('viewer').appendChild(container);
          
          await page.render({
            canvasContext: ctx,
            viewport: viewport
          }).promise;
        }
        
        function goToPage(num) {
          const element = document.getElementById('page-' + num);
          if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }
        
        function setZoom(newZoom) {
          currentZoom = newZoom;
          document.getElementById('viewer').innerHTML = '';
          loadPDF();
        }
        
        function toggleNightMode(enabled) {
          document.body.classList.toggle('night-mode', enabled);
        }
        
        function searchText(query) {
          // Basic text search implementation
          // In a full implementation, you'd use PDF.js text layer
        }
        
        // Track scroll position to update current page
        document.getElementById('viewer').addEventListener('scroll', function() {
          const containers = document.querySelectorAll('.page-container');
          for (let i = containers.length - 1; i >= 0; i--) {
            const rect = containers[i].getBoundingClientRect();
            if (rect.top <= window.innerHeight / 2) {
              window.ReactNativeWebView.postMessage(JSON.stringify({
                type: 'pageChange',
                page: i + 1
              }));
              break;
            }
          }
        });
        
        loadPDF();
      </script>
    </body>
    </html>
  `;

  const isBookmarked = bookmarks.some(b => b.page === currentPage);

  return (
    <Modal visible={true} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.container, { backgroundColor: nightMode ? '#1C1C1E' : '#F2F2F7' }]}>
        <View style={[styles.header, { paddingTop: insets.top, backgroundColor: nightMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Pressable onPress={onClose} style={styles.headerButton}>
            <Feather name="x" size={24} color={nightMode ? '#FFF' : theme.text} />
          </Pressable>
          
          <Pressable 
            style={styles.pageIndicator}
            onPress={() => setShowPageInput(true)}
          >
            <ThemedText style={[styles.pageText, { color: nightMode ? '#FFF' : theme.text }]}>
              {currentPage} / {totalPages}
            </ThemedText>
          </Pressable>
          
          <View style={styles.headerActions}>
            <Pressable onPress={() => setShowSearch(!showSearch)} style={styles.headerButton}>
              <Feather name="search" size={22} color={showSearch ? accentColor : (nightMode ? '#FFF' : theme.text)} />
            </Pressable>
            <Pressable onPress={isBookmarked ? () => removeBookmark(currentPage) : addBookmark} style={styles.headerButton}>
              <Feather name="bookmark" size={22} color={isBookmarked ? accentColor : (nightMode ? '#FFF' : theme.text)} />
            </Pressable>
            <Pressable onPress={handleShare} style={styles.headerButton}>
              <Feather name="share" size={22} color={nightMode ? '#FFF' : theme.text} />
            </Pressable>
          </View>
        </View>

        {showSearch && (
          <View style={[styles.searchBar, { backgroundColor: nightMode ? '#3A3A3C' : '#E5E5EA' }]}>
            <Feather name="search" size={18} color={nightMode ? '#8E8E93' : '#8E8E93'} />
            <TextInput
              style={[styles.searchInput, { color: nightMode ? '#FFF' : theme.text }]}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="Rechercher dans le document..."
              placeholderTextColor="#8E8E93"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <Pressable onPress={() => { setSearchQuery(''); handleSearch(''); }}>
                <Feather name="x-circle" size={18} color="#8E8E93" />
              </Pressable>
            )}
          </View>
        )}

        <View style={styles.webviewContainer}>
          {isLoading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color={accentColor} />
              <ThemedText style={[styles.loadingText, { color: theme.textSecondary }]}>
                Chargement du PDF...
              </ThemedText>
            </View>
          )}
          <WebView
            ref={webViewRef}
            source={{ html: pdfViewerHtml }}
            style={styles.webview}
            onMessage={handleMessage}
            javaScriptEnabled
            domStorageEnabled
            allowFileAccess
            mixedContentMode="compatibility"
            originWhitelist={['*']}
          />
        </View>

        <View style={[styles.toolbar, { paddingBottom: insets.bottom + 10, backgroundColor: nightMode ? '#2C2C2E' : '#FFFFFF' }]}>
          <Pressable onPress={zoomOut} style={styles.toolbarButton}>
            <Feather name="zoom-out" size={22} color={nightMode ? '#FFF' : theme.text} />
          </Pressable>
          <ThemedText style={[styles.zoomText, { color: nightMode ? '#FFF' : theme.text }]}>
            {Math.round(zoom * 100)}%
          </ThemedText>
          <Pressable onPress={zoomIn} style={styles.toolbarButton}>
            <Feather name="zoom-in" size={22} color={nightMode ? '#FFF' : theme.text} />
          </Pressable>
          
          <View style={styles.toolbarDivider} />
          
          <Pressable onPress={() => goToPage(currentPage - 1)} style={styles.toolbarButton} disabled={currentPage <= 1}>
            <Feather name="chevron-left" size={24} color={currentPage <= 1 ? '#8E8E93' : (nightMode ? '#FFF' : theme.text)} />
          </Pressable>
          <Pressable onPress={() => goToPage(currentPage + 1)} style={styles.toolbarButton} disabled={currentPage >= totalPages}>
            <Feather name="chevron-right" size={24} color={currentPage >= totalPages ? '#8E8E93' : (nightMode ? '#FFF' : theme.text)} />
          </Pressable>
          
          <View style={styles.toolbarDivider} />
          
          <Pressable onPress={toggleNightMode} style={styles.toolbarButton}>
            <Feather name={nightMode ? 'sun' : 'moon'} size={22} color={nightMode ? '#FFF' : theme.text} />
          </Pressable>
          <Pressable onPress={() => setShowBookmarks(!showBookmarks)} style={styles.toolbarButton}>
            <Feather name="list" size={22} color={showBookmarks ? accentColor : (nightMode ? '#FFF' : theme.text)} />
          </Pressable>
        </View>

        {showBookmarks && bookmarks.length > 0 && (
          <View style={[styles.bookmarksPanel, { backgroundColor: nightMode ? '#2C2C2E' : '#FFFFFF', bottom: insets.bottom + 70 }]}>
            <ThemedText style={[styles.bookmarksTitle, { color: nightMode ? '#FFF' : theme.text }]}>
              Signets ({bookmarks.length})
            </ThemedText>
            {bookmarks.map((bookmark) => (
              <Pressable
                key={bookmark.page}
                style={styles.bookmarkItem}
                onPress={() => { goToPage(bookmark.page); setShowBookmarks(false); }}
              >
                <View style={styles.bookmarkInfo}>
                  <Feather name="bookmark" size={16} color={accentColor} />
                  <ThemedText style={[styles.bookmarkText, { color: nightMode ? '#FFF' : theme.text }]}>
                    Page {bookmark.page}
                  </ThemedText>
                </View>
                <Pressable onPress={() => removeBookmark(bookmark.page)}>
                  <Feather name="x" size={18} color="#8E8E93" />
                </Pressable>
              </Pressable>
            ))}
          </View>
        )}

        {showPageInput && (
          <Modal visible transparent animationType="fade">
            <Pressable style={styles.pageInputOverlay} onPress={() => setShowPageInput(false)}>
              <View style={[styles.pageInputModal, { backgroundColor: nightMode ? '#2C2C2E' : '#FFFFFF' }]}>
                <ThemedText style={[styles.pageInputTitle, { color: nightMode ? '#FFF' : theme.text }]}>
                  Aller a la page
                </ThemedText>
                <TextInput
                  style={[styles.pageInputField, { 
                    color: nightMode ? '#FFF' : theme.text,
                    backgroundColor: nightMode ? '#3A3A3C' : '#F2F2F7',
                  }]}
                  value={pageInputValue}
                  onChangeText={setPageInputValue}
                  keyboardType="number-pad"
                  placeholder={`1 - ${totalPages}`}
                  placeholderTextColor="#8E8E93"
                  autoFocus
                />
                <View style={styles.pageInputButtons}>
                  <Pressable 
                    style={styles.pageInputButton}
                    onPress={() => setShowPageInput(false)}
                  >
                    <ThemedText style={{ color: '#8E8E93' }}>Annuler</ThemedText>
                  </Pressable>
                  <Pressable 
                    style={[styles.pageInputButton, { backgroundColor: accentColor }]}
                    onPress={() => {
                      const page = parseInt(pageInputValue);
                      if (page >= 1 && page <= totalPages) {
                        goToPage(page);
                        setShowPageInput(false);
                        setPageInputValue('');
                      }
                    }}
                  >
                    <ThemedText style={{ color: '#FFF', fontWeight: '600' }}>Aller</ThemedText>
                  </Pressable>
                </View>
              </View>
            </Pressable>
          </Modal>
        )}
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
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  pageIndicator: {
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  pageText: {
    fontSize: 14,
    fontWeight: '600',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginVertical: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
  },
  webviewContainer: {
    flex: 1,
  },
  webview: {
    flex: 1,
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
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(0,0,0,0.1)',
    gap: 8,
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
  toolbarDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(0,0,0,0.1)',
    marginHorizontal: 8,
  },
  bookmarksPanel: {
    position: 'absolute',
    left: 16,
    right: 16,
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    maxHeight: 200,
  },
  bookmarksTitle: {
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 12,
  },
  bookmarkItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  bookmarkInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bookmarkText: {
    fontSize: 15,
  },
  pageInputOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  pageInputModal: {
    width: '100%',
    borderRadius: 16,
    padding: 24,
  },
  pageInputTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  pageInputField: {
    fontSize: 18,
    padding: 14,
    borderRadius: 10,
    textAlign: 'center',
    marginBottom: 20,
  },
  pageInputButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  pageInputButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
  },
});
