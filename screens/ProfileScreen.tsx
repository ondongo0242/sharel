import { useState, useEffect } from "react";
import { StyleSheet, View, TextInput, Image, Pressable, Modal, Alert, ScrollView, Platform, useWindowDimensions } from "react-native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Feather } from "@expo/vector-icons";
import { useTranslation } from "react-i18next";
import { ThemedText } from "@/components/ThemedText";
import { useTheme } from "@/hooks/useTheme";
import { Spacing } from "@/constants/theme";
import type { ProfileStackParamList } from "@/navigation/ProfileStackNavigator";
import { ScreenKeyboardAwareScrollView } from "@/components/ScreenKeyboardAwareScrollView";
import * as ImagePicker from 'expo-image-picker';
import * as ImageManipulator from 'expo-image-manipulator';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';

type ProfileScreenProps = {
  navigation: NativeStackNavigationProp<ProfileStackParamList, "Profile">;
};

const embeddedAvatars = [
  require("../assets/avatars/a1.png"),
  require("../assets/avatars/a2.png"),
  require("../assets/avatars/a3.png"),
  require("../assets/avatars/a4.png"),
  require("../assets/avatars/a5.png"),
  require("../assets/avatars/a6.png"),
  require("../assets/avatars/a7.png"),
  require("../assets/avatars/a8.png"),
  require("../assets/avatars/a9.png"),
  require("../assets/avatars/a10.png"),
];

const embeddedCovers = [
  require("../assets/covers/c1.png"),
  require("../assets/covers/c2.png"),
  require("../assets/covers/c3.png"),
  require("../assets/covers/c4.png"),
  require("../assets/covers/c5.png"),
  require("../assets/covers/c6.png"),
];

const coolNamePrefixes = [
  "Swift", "Nova", "Blaze", "Storm", "Echo", "Frost", "Sage", "Apex",
  "Onyx", "Pulse", "Vega", "Flux", "Neon", "Pixel", "Cyber", "Aero",
  "Turbo", "Spark", "Ghost", "Prime", "Elite", "Alpha", "Omega", "Titan",
  "Phoenix", "Shadow", "Crystal", "Thunder", "Mystic", "Cosmic", "Solar", "Lunar"
];

const coolNameSuffixes = [
  "King", "Star", "Wolf", "Hawk", "Lion", "Bear", "Fox", "Tiger",
  "Eagle", "Rider", "Hunter", "Master", "Lord", "Boss", "Chief", "Ace",
  "Pro", "Max", "One", "Zen", "Knight", "Ninja", "Samurai", "Wizard"
];

const generateCoolName = (): string => {
  const prefix = coolNamePrefixes[Math.floor(Math.random() * coolNamePrefixes.length)];
  const suffix = coolNameSuffixes[Math.floor(Math.random() * coolNameSuffixes.length)];
  return `${prefix} ${suffix}`;
};

const generateUserId = (): string => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let id = '';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
};

const BIO_MAX_LENGTH = 150;

export default function ProfileScreen({ navigation }: ProfileScreenProps) {
  const { t } = useTranslation();
  const { theme, isDark, accentColor } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const rootNavigation = useNavigation();

  const [isEditMode, setIsEditMode] = useState(false);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(0);
  const [selectedCover, setSelectedCover] = useState<number | null>(null);
  const [customAvatar, setCustomAvatar] = useState<string | null>(null);
  const [customCover, setCustomCover] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState("+242 065491040");
  const [username, setUsername] = useState("@sharel_user");
  const [bio, setBio] = useState(t('home.subtitle'));
  const [displayName, setDisplayName] = useState("");
  const [userId, setUserId] = useState("");
  const [isOnline, setIsOnline] = useState(true);

  const [tempPhoneNumber, setTempPhoneNumber] = useState(phoneNumber);
  const [tempUsername, setTempUsername] = useState(username);
  const [tempBio, setTempBio] = useState(bio);
  const [tempDisplayName, setTempDisplayName] = useState(displayName);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        const savedName = await AsyncStorage.getItem('user_display_name');
        const savedId = await AsyncStorage.getItem('user_id');
        const savedCoverIndex = await AsyncStorage.getItem('user_cover_index');
        const savedCustomCover = await AsyncStorage.getItem('user_custom_cover');
        const savedBio = await AsyncStorage.getItem('user_bio');
        const savedPhone = await AsyncStorage.getItem('user_phone');
        const savedUsername = await AsyncStorage.getItem('user_username');

        if (savedBio) setBio(savedBio);
        if (savedPhone) setPhoneNumber(savedPhone);
        if (savedUsername) setUsername(savedUsername);

        if (savedName) {
          setDisplayName(savedName);
        } else {
          const newName = generateCoolName();
          setDisplayName(newName);
          await AsyncStorage.setItem('user_display_name', newName);
        }

        if (savedId) {
          setUserId(savedId);
        } else {
          const newId = generateUserId();
          setUserId(newId);
          await AsyncStorage.setItem('user_id', newId);
        }

        if (savedCustomCover) {
          setCustomCover(savedCustomCover);
          setSelectedCover(null);
        } else if (savedCoverIndex !== null) {
          setSelectedCover(parseInt(savedCoverIndex, 10));
          setCustomCover(null);
        }
      } catch (error) {
        const newName = generateCoolName();
        const newId = generateUserId();
        setDisplayName(newName);
        setUserId(newId);
      }
    };

    loadUserData();
  }, []);

  const handleEditToggle = async () => {
    if (isEditMode) {
      setPhoneNumber(tempPhoneNumber);
      setUsername(tempUsername);
      setBio(tempBio);
      setDisplayName(tempDisplayName);
      try {
        await AsyncStorage.setItem('user_display_name', tempDisplayName);
        await AsyncStorage.setItem('user_bio', tempBio);
        await AsyncStorage.setItem('user_phone', tempPhoneNumber);
        await AsyncStorage.setItem('user_username', tempUsername);
      } catch (error) {}
    } else {
      setTempPhoneNumber(phoneNumber);
      setTempUsername(username);
      setTempBio(bio);
      setTempDisplayName(displayName);
    }
    setIsEditMode(!isEditMode);
  };

  const handleSelectEmbeddedAvatar = (index: number) => {
    setSelectedAvatar(index);
    setCustomAvatar(null);
    setShowAvatarPicker(false);
  };

  const handleSelectEmbeddedCover = async (index: number) => {
    setSelectedCover(index);
    setCustomCover(null);
    setShowCoverPicker(false);
    try {
      await AsyncStorage.setItem('user_cover_index', index.toString());
      await AsyncStorage.removeItem('user_custom_cover');
    } catch (error) {}
  };

  const handlePickAvatarFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(t('profile.permissionDenied'), t('profile.permissionDeniedDesc'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      const manipResult = await ImageManipulator.manipulateAsync(
        result.assets[0].uri,
        [{ resize: { width: 400, height: 400 } }],
        { compress: 0.8, format: ImageManipulator.SaveFormat.JPEG }
      );
      setCustomAvatar(manipResult.uri);
      setShowAvatarPicker(false);
    }
  };

  const handlePickCoverFromGallery = async () => {
    const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (permissionResult.granted === false) {
      Alert.alert(t('profile.permissionDenied'), t('profile.permissionDeniedDesc'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
    });

    if (!result.canceled && result.assets[0]) {
      setCustomCover(result.assets[0].uri);
      setSelectedCover(null);
      setShowCoverPicker(false);
      try {
        await AsyncStorage.setItem('user_custom_cover', result.assets[0].uri);
        await AsyncStorage.removeItem('user_cover_index');
      } catch (error) {}
    }
  };

  const handleShareSharel = () => {
    (rootNavigation as any).navigate('HomeTab', {
      screen: 'ShareSharel',
    });
  };

  const settingsItems = [
    { icon: "settings", title: t('profile.general'), screen: "GeneralSettings" as const },
    { icon: "sliders", title: t('profile.preferences'), screen: "PreferencesSettings" as const },
    { icon: "lock", title: t('profile.privacySecurity'), screen: "PrivacySecuritySettings" as const },
    { icon: "bell", title: t('profile.notificationsSounds'), screen: "NotificationsSettings" as const },
    { icon: "hard-drive", title: t('profile.storageData'), screen: "StorageDataSettings" as const },
    { icon: "cloud", title: t('profile.sharelCloud'), screen: "SharelCloudSettings" as const },
    { icon: "move", title: "Gestures & Shortcuts", screen: "GesturesSettings" as const },
  ];

  const currentAvatar = customAvatar 
    ? { uri: customAvatar } 
    : embeddedAvatars[selectedAvatar];

  const currentCover = customCover
    ? { uri: customCover }
    : selectedCover !== null
    ? embeddedCovers[selectedCover]
    : null;

  return (
    <>
      <ScreenKeyboardAwareScrollView 
        style={[styles.scrollView, { backgroundColor: theme.backgroundDefault }]}
        contentContainerStyle={styles.scrollContent}
      >
        <View style={[styles.coverContainer, { width: screenWidth, marginLeft: -Spacing.xl }]}>
          {currentCover ? (
            <Image source={currentCover} style={styles.coverPhoto} resizeMode="cover" />
          ) : (
            <View style={[styles.coverPlaceholder, { backgroundColor: isDark ? theme.backgroundTertiary : theme.backgroundSecondary }]} />
          )}
          <Pressable onPress={() => setShowCoverPicker(true)} style={styles.coverEditButton}>
            <Feather name="camera" size={16} color="#FFFFFF" />
          </Pressable>
        </View>

        <View style={[styles.profileSection, { backgroundColor: theme.backgroundDefault, borderBottomColor: theme.border }]}>
          <View style={styles.avatarRow}>
            <View style={styles.avatarWrapper}>
              <Pressable onPress={() => setShowAvatarPicker(true)} style={styles.avatarPressable}>
                <Image source={currentAvatar} style={[styles.avatar, { borderColor: theme.backgroundDefault }]} />
                <View style={[styles.onlineIndicator, { backgroundColor: isOnline ? theme.success : theme.textSecondary, borderColor: theme.backgroundDefault }]} />
              </Pressable>
              <Pressable onPress={() => setShowAvatarPicker(true)} style={[styles.avatarEditButton, { backgroundColor: accentColor, borderColor: theme.backgroundDefault }]}>
                <Feather name="camera" size={14} color="#FFFFFF" />
              </Pressable>
            </View>

            <View style={styles.userInfoContainer}>
              {isEditMode ? (
                <TextInput
                  value={tempDisplayName}
                  onChangeText={setTempDisplayName}
                  style={[styles.displayNameInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                  placeholder={t('profile.displayName')}
                  placeholderTextColor={theme.textSecondary}
                  underlineColorAndroid="transparent"
                  selectionColor={accentColor}
                />
              ) : (
                <ThemedText style={[styles.displayName, { color: theme.text }]}>{displayName}</ThemedText>
              )}
              <ThemedText style={[styles.idText, { color: theme.textSecondary }]}>ID: {userId}</ThemedText>
            </View>

            <Pressable onPress={handleEditToggle} style={[styles.editButton, { backgroundColor: accentColor }]}>
              <Feather name={isEditMode ? "check" : "edit-2"} size={16} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>{t('profile.account')}</ThemedText>

          <View style={[styles.accountItem, { borderBottomColor: theme.border }]}>
            {isEditMode ? (
              <TextInput
                value={tempPhoneNumber}
                onChangeText={setTempPhoneNumber}
                style={[styles.accountValueInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                placeholder={t('profile.phoneNumber')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="phone-pad"
                underlineColorAndroid="transparent"
                selectionColor={accentColor}
              />
            ) : (
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>{phoneNumber}</ThemedText>
            )}
            <ThemedText style={[styles.accountLabel, { color: theme.textSecondary }]}>{t('profile.phoneNumber')}</ThemedText>
          </View>

          <View style={[styles.accountItem, { borderBottomColor: theme.border }]}>
            {isEditMode ? (
              <TextInput
                value={tempUsername}
                onChangeText={setTempUsername}
                style={[styles.accountValueInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                placeholder={t('profile.username')}
                placeholderTextColor={theme.textSecondary}
                underlineColorAndroid="transparent"
                selectionColor={accentColor}
              />
            ) : (
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>{username}</ThemedText>
            )}
            <ThemedText style={[styles.accountLabel, { color: theme.textSecondary }]}>{t('profile.username')}</ThemedText>
          </View>

          <View style={[styles.accountItem, { borderBottomColor: theme.border }]}>
            {isEditMode ? (
              <View style={styles.bioInputContainer}>
                <TextInput
                  value={tempBio}
                  onChangeText={setTempBio}
                  style={[styles.bioInput, { color: theme.text, backgroundColor: theme.backgroundSecondary }]}
                  placeholder={t('profile.bio')}
                  placeholderTextColor={theme.textSecondary}
                  multiline
                  numberOfLines={4}
                  textAlignVertical="top"
                  maxLength={BIO_MAX_LENGTH}
                  underlineColorAndroid="transparent"
                  selectionColor={accentColor}
                />
                <ThemedText style={[styles.bioCounter, { color: tempBio.length >= BIO_MAX_LENGTH ? theme.error : theme.textSecondary }]}>
                  {tempBio.length}/{BIO_MAX_LENGTH}
                </ThemedText>
              </View>
            ) : (
              <ThemedText style={[styles.accountValue, { color: theme.text }]}>{bio}</ThemedText>
            )}
            <ThemedText style={[styles.accountLabel, { color: theme.textSecondary }]}>{t('profile.bio')}</ThemedText>
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.backgroundDefault }]}>
          <ThemedText style={[styles.sectionTitle, { color: accentColor }]}>{t('profile.settings')}</ThemedText>

          {settingsItems.map((item, index) => (
            <Pressable
              key={index}
              style={({ pressed }) => [
                styles.settingItem,
                { opacity: pressed ? 0.6 : 1, borderBottomColor: theme.border }
              ]}
              onPress={() => {
                if (item.screen) {
                  navigation.navigate(item.screen);
                }
              }}
            >
              <View style={styles.settingLeft}>
                <View style={[styles.iconCircle, { backgroundColor: theme.backgroundSecondary }]}>
                  <Feather name={item.icon as any} size={20} color={theme.textSecondary} />
                </View>
                <ThemedText style={[styles.settingText, { color: theme.text }]}>{item.title}</ThemedText>
              </View>
              <Feather name="chevron-right" size={20} color={theme.textSecondary} />
            </Pressable>
          ))}
        </View>

        <View style={styles.shareButtonContainer}>
          <Pressable
            onPress={handleShareSharel}
            style={({ pressed }) => [
              styles.shareButton,
              { backgroundColor: accentColor, opacity: pressed ? 0.8 : 1 }
            ]}
          >
            <Feather name="share-2" size={20} color="#FFFFFF" />
            <ThemedText style={styles.shareButtonText}>{t('profile.shareSharel')}</ThemedText>
          </Pressable>
        </View>
      </ScreenKeyboardAwareScrollView>

      <Modal
        visible={showAvatarPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAvatarPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowAvatarPicker(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24, backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{t('profile.choosePhoto')}</ThemedText>
              <Pressable onPress={() => setShowAvatarPicker(false)} hitSlop={8}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>{t('profile.embeddedPhotos')}</ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.embeddedAvatarsContainer}
              contentContainerStyle={styles.embeddedAvatarsContent}
            >
              {embeddedAvatars.map((avatar, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleSelectEmbeddedAvatar(index)}
                  style={[
                    styles.embeddedAvatarItem,
                    selectedAvatar === index && !customAvatar && { borderColor: accentColor }
                  ]}
                >
                  <Image source={avatar} style={styles.embeddedAvatar} />
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>{t('profile.orFromGallery')}</ThemedText>
            <Pressable onPress={handlePickAvatarFromGallery} style={[styles.galleryButton, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="image" size={20} color={accentColor} />
              <ThemedText style={[styles.galleryButtonText, { color: accentColor }]}>{t('profile.chooseFromGallery')}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={showCoverPicker}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowCoverPicker(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setShowCoverPicker(false)}>
          <View style={[styles.modalContent, { paddingBottom: insets.bottom + 24, backgroundColor: theme.backgroundDefault }]}>
            <View style={styles.dragHandleContainer}>
              <View style={[styles.dragHandle, { backgroundColor: theme.border }]} />
            </View>

            <View style={styles.modalHeader}>
              <ThemedText style={[styles.modalTitle, { color: theme.text }]}>{t('profile.chooseCover')}</ThemedText>
              <Pressable onPress={() => setShowCoverPicker(false)} hitSlop={8}>
                <Feather name="x" size={24} color={theme.textSecondary} />
              </Pressable>
            </View>

            <ThemedText style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>{t('profile.embeddedCovers')}</ThemedText>
            <ScrollView 
              horizontal 
              showsHorizontalScrollIndicator={false} 
              style={styles.embeddedCoversContainer}
              contentContainerStyle={styles.embeddedCoversContent}
            >
              {embeddedCovers.map((cover, index) => (
                <Pressable
                  key={index}
                  onPress={() => handleSelectEmbeddedCover(index)}
                  style={[
                    styles.embeddedCoverItem,
                    selectedCover === index && !customCover && { borderColor: accentColor }
                  ]}
                >
                  <Image source={cover} style={styles.embeddedCover} />
                </Pressable>
              ))}
            </ScrollView>

            <ThemedText style={[styles.modalSectionTitle, { color: theme.textSecondary }]}>{t('profile.orFromGallery')}</ThemedText>
            <Pressable onPress={handlePickCoverFromGallery} style={[styles.galleryButton, { backgroundColor: theme.backgroundSecondary }]}>
              <Feather name="image" size={20} color={accentColor} />
              <ThemedText style={[styles.galleryButtonText, { color: accentColor }]}>{t('profile.chooseFromGallery')}</ThemedText>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingTop: 0,
    paddingBottom: Spacing["3xl"],
  },
  coverContainer: {
    height: 180,
    position: "relative",
    marginTop: -Spacing.xl,
  },
  coverPhoto: {
    width: "100%",
    height: "100%",
  },
  coverPlaceholder: {
    width: "100%",
    height: "100%",
  },
  coverEditButton: {
    position: "absolute",
    bottom: 12,
    right: 12,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  profileSection: {
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  avatarRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatarWrapper: {
    position: "relative",
    marginTop: -60,
  },
  avatarPressable: {
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 4,
  },
  onlineIndicator: {
    position: "absolute",
    bottom: 6,
    right: 6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
  },
  avatarEditButton: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
  },
  userInfoContainer: {
    flex: 1,
    marginLeft: 16,
    justifyContent: "center",
  },
  displayName: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  displayNameInput: {
    fontSize: 18,
    fontWeight: "600",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 0,
  },
  idText: {
    fontSize: 13,
    fontWeight: "500",
  },
  editButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  section: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    paddingTop: 16,
    paddingBottom: 8,
  },
  accountItem: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  accountValue: {
    fontSize: 16,
    marginBottom: 2,
  },
  accountLabel: {
    fontSize: 13,
  },
  accountValueInput: {
    fontSize: 16,
    marginBottom: 2,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 0,
  },
  bioInputContainer: {
    position: "relative",
  },
  bioInput: {
    fontSize: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 28,
    borderRadius: 8,
    borderWidth: 0,
    minHeight: 100,
  },
  bioCounter: {
    position: "absolute",
    bottom: 8,
    right: 12,
    fontSize: 12,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  settingLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
    flex: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  settingText: {
    fontSize: 15,
  },
  shareButtonContainer: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  shareButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 14,
  },
  shareButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "600",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 24,
    paddingTop: 8,
  },
  dragHandleContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  dragHandle: {
    width: 40,
    height: 5,
    borderRadius: 3,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "700",
  },
  modalSectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 12,
    marginTop: 8,
  },
  embeddedAvatarsContainer: {
    marginBottom: 16,
  },
  embeddedAvatarsContent: {
    paddingRight: 24,
  },
  embeddedAvatarItem: {
    marginRight: 12,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: "transparent",
  },
  embeddedAvatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
  },
  embeddedCoversContainer: {
    marginBottom: 16,
  },
  embeddedCoversContent: {
    paddingRight: 24,
  },
  embeddedCoverItem: {
    marginRight: 12,
    borderRadius: 12,
    borderWidth: 3,
    borderColor: "transparent",
    overflow: "hidden",
  },
  embeddedCover: {
    width: 140,
    height: 80,
    borderRadius: 10,
  },
  galleryButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingVertical: 16,
    borderRadius: 16,
    marginTop: 8,
    marginBottom: 16,
  },
  galleryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
