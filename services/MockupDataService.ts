import { Platform } from 'react-native';

export interface MockupImage {
  id: string;
  name: string;
  uri: string;
  size: number;
  width: number;
  height: number;
  createdAt: number;
}

export interface MockupVideo {
  id: string;
  name: string;
  uri: string;
  size: number;
  duration: number;
  thumbnail: string;
  createdAt: number;
}

export interface MockupAudio {
  id: string;
  name: string;
  uri: string;
  size: number;
  duration: number;
  artist?: string;
  album?: string;
  artwork?: string;
  createdAt: number;
}

export interface MockupDocument {
  id: string;
  name: string;
  uri: string;
  size: number;
  type: 'pdf' | 'doc' | 'docx' | 'txt' | 'xlsx';
  createdAt: number;
}

export interface MockupApp {
  id: string;
  name: string;
  size: number;
  icon?: string;
  isInstalled: boolean;
  isNew: boolean;
  firstInstallTime: number;
  uri?: string;
}

const MOCK_IMAGES: MockupImage[] = [
  {
    id: 'mock-img-1',
    name: 'nature_landscape_1.jpg',
    uri: 'https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80',
    size: 2458624,
    width: 1920,
    height: 1080,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-2',
    name: 'nature_landscape_2.jpg',
    uri: 'https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80',
    size: 3145728,
    width: 1920,
    height: 1280,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-3',
    name: 'sunset_beach.jpg',
    uri: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1920&q=80',
    size: 2097152,
    width: 1600,
    height: 900,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-4',
    name: 'mountain_view.jpg',
    uri: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?w=1920&q=80',
    size: 1572864,
    width: 1200,
    height: 800,
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-5',
    name: 'forest_path.jpg',
    uri: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80',
    size: 1835008,
    width: 1200,
    height: 900,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-6',
    name: 'city_night.jpg',
    uri: 'https://images.unsplash.com/photo-1514565131-fce0801e5785?w=1920&q=80',
    size: 2621440,
    width: 1920,
    height: 1080,
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-7',
    name: 'ocean_waves.jpg',
    uri: 'https://images.unsplash.com/photo-1505142468610-359e7d316be0?w=1920&q=80',
    size: 1966080,
    width: 1920,
    height: 1280,
    createdAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-img-8',
    name: 'autumn_leaves.jpg',
    uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=1920&q=80',
    size: 2359296,
    width: 1600,
    height: 1067,
    createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000,
  },
];

const MOCK_VIDEOS: MockupVideo[] = [
  {
    id: 'mock-vid-1',
    name: 'Big Buck Bunny.mp4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    thumbnail: 'https://i.ytimg.com/vi/aqz-KE-bpKQ/maxresdefault.jpg',
    size: 158334976,
    duration: 596,
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-vid-2',
    name: 'Elephant Dream.mp4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/e8/Elephants_Dream_s5_both.jpg/1200px-Elephants_Dream_s5_both.jpg',
    size: 69345280,
    duration: 653,
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-vid-3',
    name: 'Sintel.mp4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Sintel_poster.jpg/440px-Sintel_poster.jpg',
    size: 132165632,
    duration: 888,
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-vid-4',
    name: 'Tears of Steel.mp4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4',
    thumbnail: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/66/Tears_of_Steel.jpg/440px-Tears_of_Steel.jpg',
    size: 95420416,
    duration: 734,
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-vid-5',
    name: 'For Bigger Blazes.mp4',
    uri: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnail: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/images/ForBiggerBlazes.jpg',
    size: 12582912,
    duration: 15,
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

const MOCK_AUDIO: MockupAudio[] = [
  {
    id: 'mock-audio-1',
    name: 'Relaxing Music.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
    size: 8388608,
    duration: 375,
    artist: 'SoundHelix',
    album: 'Relaxation',
    artwork: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=300&q=80',
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-audio-2',
    name: 'Ambient Waves.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3',
    size: 7340032,
    duration: 322,
    artist: 'SoundHelix',
    album: 'Ambient',
    artwork: 'https://images.unsplash.com/photo-1459749411175-04bf5292ceea?w=300&q=80',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-audio-3',
    name: 'Electronic Beats.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3',
    size: 9437184,
    duration: 412,
    artist: 'SoundHelix',
    album: 'Electronic',
    artwork: 'https://images.unsplash.com/photo-1470225620780-dba8ba36b745?w=300&q=80',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-audio-4',
    name: 'Jazz Vibes.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3',
    size: 6815744,
    duration: 298,
    artist: 'SoundHelix',
    album: 'Jazz',
    artwork: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=300&q=80',
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-audio-5',
    name: 'Classical Symphony.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3',
    size: 10485760,
    duration: 456,
    artist: 'SoundHelix',
    album: 'Classical',
    artwork: 'https://images.unsplash.com/photo-1507838153414-b4b713384a76?w=300&q=80',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-audio-6',
    name: 'Deep Focus.mp3',
    uri: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-6.mp3',
    size: 7864320,
    duration: 345,
    artist: 'SoundHelix',
    album: 'Focus',
    artwork: 'https://images.unsplash.com/photo-1514320291840-2e0a9bf2a9ae?w=300&q=80',
    createdAt: Date.now() - 6 * 24 * 60 * 60 * 1000,
  },
];

const MOCK_DOCUMENTS: MockupDocument[] = [
  {
    id: 'mock-doc-1',
    name: 'Rapport Annuel 2024.pdf',
    uri: 'https://www.w3.org/WAI/WCAG21/Techniques/pdf/img/table-word.pdf',
    size: 2097152,
    type: 'pdf',
    createdAt: Date.now() - 1 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-doc-2',
    name: 'Presentation Projet.docx',
    uri: '',
    size: 1048576,
    type: 'docx',
    createdAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-doc-3',
    name: 'Notes Reunion.txt',
    uri: '',
    size: 4096,
    type: 'txt',
    createdAt: Date.now() - 3 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-doc-4',
    name: 'Budget 2024.xlsx',
    uri: '',
    size: 524288,
    type: 'xlsx',
    createdAt: Date.now() - 4 * 24 * 60 * 60 * 1000,
  },
  {
    id: 'mock-doc-5',
    name: 'Contract.pdf',
    uri: 'https://www.africau.edu/images/default/sample.pdf',
    size: 3145728,
    type: 'pdf',
    createdAt: Date.now() - 5 * 24 * 60 * 60 * 1000,
  },
];

const MOCK_APPS: MockupApp[] = (() => {
  const now = Date.now();
  const dayMs = 24 * 60 * 60 * 1000;
  return [
    { id: 'app-1', name: 'SHAREL', size: 33030144, icon: 'https://img.icons8.com/fluency/96/share.png', isInstalled: true, isNew: true, firstInstallTime: now - (2 * dayMs) },
    { id: 'app-2', name: 'Contacts', size: 5033164, icon: 'https://img.icons8.com/fluency/96/contacts.png', isInstalled: true, isNew: true, firstInstallTime: now - (1 * dayMs) },
    { id: 'app-3', name: 'SHAREit', size: 84721664, icon: 'https://img.icons8.com/fluency/96/share-2.png', isInstalled: true, isNew: true, firstInstallTime: now - (3 * dayMs) },
    { id: 'app-4', name: 'SAI', size: 16560742, icon: 'https://img.icons8.com/fluency/96/android-os.png', isInstalled: true, isNew: true, firstInstallTime: now - (5 * dayMs) },
    { id: 'app-5', name: 'LogFox', size: 4088218, icon: 'https://img.icons8.com/fluency/96/console.png', isInstalled: true, isNew: true, firstInstallTime: now - (6 * dayMs) },
    { id: 'app-6', name: 'Brevent', size: 1991900, icon: 'https://img.icons8.com/fluency/96/settings.png', isInstalled: true, isNew: false, firstInstallTime: now - (30 * dayMs) },
    { id: 'app-7', name: 'Package Manager', size: 1782579, icon: 'https://img.icons8.com/fluency/96/package.png', isInstalled: true, isNew: false, firstInstallTime: now - (60 * dayMs) },
    { id: 'app-8', name: 'Chrome', size: 47395840, icon: 'https://img.icons8.com/fluency/96/chrome.png', isInstalled: true, isNew: false, firstInstallTime: now - (45 * dayMs) },
    { id: 'app-9', name: 'YouTube', size: 82532557, icon: 'https://img.icons8.com/fluency/96/youtube-play.png', isInstalled: true, isNew: false, firstInstallTime: now - (90 * dayMs) },
    { id: 'app-10', name: 'WhatsApp', size: 51909632, icon: 'https://img.icons8.com/fluency/96/whatsapp.png', isInstalled: true, isNew: false, firstInstallTime: now - (120 * dayMs) },
    { id: 'app-11', name: 'Calendar', size: 30617190, icon: 'https://img.icons8.com/fluency/96/calendar.png', isInstalled: true, isNew: false, firstInstallTime: now - (100 * dayMs) },
    { id: 'app-12', name: 'Gallery', size: 40478925, icon: 'https://img.icons8.com/fluency/96/gallery.png', isInstalled: true, isNew: false, firstInstallTime: now - (70 * dayMs) },
    { id: 'app-13', name: 'Maps', size: 62936012, icon: 'https://img.icons8.com/fluency/96/google-maps.png', isInstalled: true, isNew: false, firstInstallTime: now - (150 * dayMs) },
    { id: 'app-14', name: 'Music', size: 13107200, icon: 'https://img.icons8.com/fluency/96/music.png', isInstalled: true, isNew: false, firstInstallTime: now - (200 * dayMs) },
    { id: 'app-15', name: 'Camera', size: 25165824, icon: 'https://img.icons8.com/fluency/96/camera.png', isInstalled: true, isNew: false, firstInstallTime: now - (180 * dayMs) },
    { id: 'app-16', name: 'Files', size: 18874368, icon: 'https://img.icons8.com/fluency/96/folder-invoices.png', isInstalled: true, isNew: false, firstInstallTime: now - (160 * dayMs) },
    { id: 'apk-1', name: 'Facebook Lite', size: 2621440, icon: 'https://img.icons8.com/fluency/96/facebook-new.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/facebook-lite.apk' },
    { id: 'apk-2', name: 'VLC Media Player', size: 31457280, icon: 'https://img.icons8.com/fluency/96/vlc.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/vlc.apk' },
    { id: 'apk-3', name: 'Telegram', size: 47185920, icon: 'https://img.icons8.com/fluency/96/telegram-app.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/telegram.apk' },
    { id: 'apk-4', name: 'Spotify', size: 52428800, icon: 'https://img.icons8.com/fluency/96/spotify.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/spotify.apk' },
    { id: 'apk-5', name: 'Discord', size: 104857600, icon: 'https://img.icons8.com/fluency/96/discord-logo.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/discord.apk' },
    { id: 'apk-6', name: 'Netflix', size: 78643200, icon: 'https://img.icons8.com/fluency/96/netflix.png', isInstalled: false, isNew: false, firstInstallTime: 0, uri: '/downloads/netflix.apk' },
  ];
})();

class MockupDataServiceClass {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized || Platform.OS !== 'web') return;
    this.initialized = true;
  }

  isWebPlatform(): boolean {
    return Platform.OS === 'web';
  }

  getImages(): MockupImage[] {
    return Platform.OS === 'web' ? MOCK_IMAGES : [];
  }

  getVideos(): MockupVideo[] {
    return Platform.OS === 'web' ? MOCK_VIDEOS : [];
  }

  getAudio(): MockupAudio[] {
    return Platform.OS === 'web' ? MOCK_AUDIO : [];
  }

  getDocuments(): MockupDocument[] {
    return Platform.OS === 'web' ? MOCK_DOCUMENTS : [];
  }

  getApps(filter: 'installed' | 'not-installed' | 'all' = 'all'): MockupApp[] {
    if (Platform.OS !== 'web') return [];
    
    if (filter === 'installed') {
      return MOCK_APPS.filter(app => app.isInstalled);
    } else if (filter === 'not-installed') {
      return MOCK_APPS.filter(app => !app.isInstalled);
    }
    return MOCK_APPS;
  }

  getMediaCounts(): { images: number; videos: number; audio: number } {
    if (Platform.OS !== 'web') {
      return { images: 0, videos: 0, audio: 0 };
    }

    return {
      images: MOCK_IMAGES.length,
      videos: MOCK_VIDEOS.length,
      audio: MOCK_AUDIO.length,
    };
  }

  getDocumentCounts(): { documents: number; apk: number; zip: number; others: number } {
    if (Platform.OS !== 'web') {
      return { documents: 0, apk: 0, zip: 0, others: 0 };
    }

    return {
      documents: MOCK_DOCUMENTS.length,
      apk: MOCK_APPS.length,
      zip: 2,
      others: 1,
    };
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDuration(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}

export const MockupDataService = new MockupDataServiceClass();
