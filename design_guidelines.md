# SHAREL - Design Guidelines

## Architecture

### Authentication
**No Auth Required** - File sharing is peer-to-peer and local-first.
- Include Profile/Settings screen with:
  - User-customizable avatar (generate 4 liquid glass style avatars with gradient backgrounds)
  - Display name field (defaults to device name)
  - App preferences (theme toggle, auto-accept transfers, storage management)

### Navigation Structure
**Tab Navigation** (4 tabs) with floating action button for core "Send Files" action:
- **Home** - Dashboard with storage cards and recent transfers
- **Receive** - Active receiving interface
- **Files** - Browse received files
- **Profile** - Settings and account management

Floating Action Button (FAB) positioned bottom-right for "Send Files" action.

---

## Screen Specifications

### 1. Home Screen
**Purpose:** Display storage overview and quick access to recent transfers.

**Layout:**
- **Header:** Transparent, centered title "SHAREL", no buttons
- **Safe Area Insets:** Top: headerHeight + 32px, Bottom: tabBarHeight + 32px
- **Root View:** Scrollable (ScrollView)
- **Floating Elements:** FAB for "Send Files" (bottom-right, 16px from edges)

**Content Structure:**
1. **Storage Cards Section** (top):
   - Two glass-morphism cards side-by-side with 12px gap
   - Left card: "Phone Storage" with colored progress ring (system blue gradient)
   - Right card: "Sharel Storage" with colored progress ring (brand gradient)
   - Each card shows: Icon, label, used/total GB, circular progress indicator
   - Card backdrop: frosted glass effect with subtle border
   
2. **Quick Actions Row:**
   - Three glass buttons: "Send", "Receive", "Scan QR"
   - Horizontal layout with 8px gaps
   
3. **Recent Transfers List:**
   - Section header: "Recent" with "See All" link
   - Glass-morphism cards for each transfer
   - Shows: File icon, name, size, timestamp, transfer status indicator
   - Maximum 5 items, rest in dedicated history screen

**Components:**
- Glass-morphism storage cards with progress rings
- Quick action pill buttons
- Transfer history cards with status badges

---

### 2. Send Files Screen (Modal)
**Purpose:** Select and send files to nearby devices.

**Layout:**
- **Header:** Custom navigation with "Cancel" left, "Send Files" title, "Send" right (disabled until files selected)
- **Safe Area Insets:** Top: insets.top + 24px, Bottom: insets.bottom + 24px
- **Root View:** Scrollable form

**Content Structure:**
1. **Device Scanner Section:**
   - Glass card with pulsing animation
   - "Searching for devices..." or list of discovered devices
   - Device cards show: Avatar, device name, OS icon, signal strength

2. **File Selection Section:**
   - Tabs: Photos, Videos, Documents, Apps, Music
   - Grid layout for media (3 columns), list for documents
   - Multi-select with checkboxes
   - Selected count badge

3. **Bottom Action:**
   - Fixed glass button: "Send to [Device Name]" with file count
   - Shows total size of selected files

**Components:**
- Device discovery cards with connection status
- Media grid with selection overlays
- Category tabs with active indicator
- Selection counter badge

---

### 3. Receive Screen
**Purpose:** Accept incoming file transfers.

**Layout:**
- **Header:** Transparent, "Receive" title, "QR Code" right button
- **Safe Area Insets:** Top: headerHeight + 32px, Bottom: tabBarHeight + 32px
- **Root View:** Static (no scroll)

**Content Structure:**
1. **Receiver Status Card (center):**
   - Large glass card with liquid animation background
   - QR code display (tappable to enlarge)
   - Device name and icon
   - "Visible to nearby devices" status text

2. **Waiting State:**
   - Animated pulsing indicator
   - "Waiting for files..." message

3. **Active Transfer State:**
   - Sender device info card
   - File preview thumbnails (horizontal scroll)
   - Progress bar with percentage and speed (MB/s)
   - "Accept" / "Decline" action buttons

**Components:**
- Large animated status card
- QR code display
- Progress indicator with speed metrics
- Accept/Decline action buttons (glass style)

---

### 4. Files Screen
**Purpose:** Browse and manage received files.

**Layout:**
- **Header:** Transparent, "Files" title, "Sort" right button, search bar (collapsible)
- **Safe Area Insets:** Top: headerHeight + 24px, Bottom: tabBarHeight + 24px
- **Root View:** List (SectionList)

**Content Structure:**
1. **Storage Summary Banner:**
   - Glass card showing total received files size
   - "Clean Up" button for clearing old files

2. **File List (grouped by date):**
   - Section headers: "Today", "Yesterday", "Last 7 Days", "Older"
   - File cards with: Type icon, name, size, sender device, timestamp
   - Swipe actions: Share, Delete
   - Long-press for batch selection

**Components:**
- Collapsible search bar
- Storage summary banner
- Sectioned file list with swipe actions
- Sort/filter bottom sheet modal

---

### 5. Profile Screen
**Purpose:** User preferences and app settings.

**Layout:**
- **Header:** Transparent, "Profile" title, no buttons
- **Safe Area Insets:** Top: headerHeight + 32px, Bottom: tabBarHeight + 32px
- **Root View:** Scrollable (ScrollView)

**Content Structure:**
1. **User Card (top):**
   - Large glass card with gradient background
   - Centered avatar (tappable to change)
   - Display name (editable on tap)
   - Device model and OS version

2. **Settings Sections:**
   - **Preferences:** Auto-accept from contacts, Save to Photos, Vibration feedback
   - **Storage:** Manage Sharel storage, Clear cache, Default save location
   - **Appearance:** Theme toggle (Light/Dark/Auto), Accent color picker
   - **About:** App version, Privacy policy, Terms of service

**Components:**
- Large user profile card
- Grouped settings list with toggle switches
- Storage management interface
- Theme selector with preview

---

## Design System

### Color Palette
**Primary (Liquid Glass Brand):**
- Primary Gradient: #667EEA → #764BA2 (purple-blue gradient)
- Background Light: #F8F9FD
- Background Dark: #0F0F23

**Semantic Colors:**
- Success: #10B981 (green)
- Warning: #F59E0B (amber)
- Error: #EF4444 (red)
- Info: #3B82F6 (blue)

**Progress Bar Colors:**
- Storage Used: #667EEA → #764BA2 gradient
- Transfer Progress: #10B981 → #3B82F6 gradient
- Low Storage: #F59E0B → #EF4444 gradient

**Glass Morphism:**
- Card Background: rgba(255, 255, 255, 0.08) [Dark], rgba(255, 255, 255, 0.70) [Light]
- Border: rgba(255, 255, 255, 0.18)
- Backdrop Filter: blur(20px)

### Typography
- **Display:** SF Pro Display, Bold, 32px (screen titles)
- **Heading:** SF Pro Text, Semibold, 20px (section headers)
- **Body:** SF Pro Text, Regular, 16px (primary text)
- **Caption:** SF Pro Text, Regular, 14px (metadata)
- **Label:** SF Pro Text, Medium, 12px (tags, badges)

### Component Specifications

**Glass Cards:**
- Border radius: 24px
- Padding: 20px
- Subtle border: 1px, rgba(255, 255, 255, 0.18)
- Shadow: width: 0, height: 8, opacity: 0.08, radius: 16

**FAB (Send Files):**
- Size: 64x64px
- Border radius: 32px (circular)
- Gradient background: Primary gradient
- Icon: Feather "send" icon, white, 24px
- Shadow: width: 0, height: 4, opacity: 0.20, radius: 8
- Press feedback: Scale down to 0.95

**Progress Rings (Storage):**
- Stroke width: 8px
- Size: 80x80px
- Background track: rgba(255, 255, 255, 0.1)
- Progress gradient: Animated sweep
- Center text: Percentage, 18px, Semibold

**Tab Bar:**
- Background: Glass morphism card
- Height: 80px (includes safe area)
- Icons: Feather icons, 24px
- Active state: Primary gradient color
- Inactive state: 40% opacity

**Icons:**
- Navigation: Feather "home", "download", "folder", "user"
- Actions: Feather "send", "camera", "share-2", "trash-2"
- File types: Feather "file-text", "image", "film", "music"

### Critical Assets

Generate 4 assets:
1. **User Avatars (4 variants):**
   - Abstract liquid glass shapes with gradients
   - Colors: Blue-purple, Green-teal, Orange-pink, Purple-red
   - Size: 120x120px, transparent background
   
2. **Empty State Illustration:**
   - Liquid glass floating elements for "No files yet"
   - Gradient: Primary colors
   - Size: 240x240px

### Accessibility
- Minimum touch target: 44x44pt (Apple HIG)
- Color contrast ratio: 4.5:1 for body text, 3:1 for large text
- Dynamic Type support: Scale text sizes
- VoiceOver labels for all interactive elements
- Haptic feedback on transfer complete, errors