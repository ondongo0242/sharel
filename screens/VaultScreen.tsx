import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  Pressable,
  Text,
  Modal,
  TextInput,
  Alert,
  Platform,
  FlatList,
  ActivityIndicator,
  Dimensions,
  PanResponder,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import * as LocalAuthentication from "expo-local-authentication";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { useFocusEffect } from "@react-navigation/native";
import Animated, {
  FadeIn,
  FadeOut,
  SlideInDown,
  SlideOutDown,
} from "react-native-reanimated";
import VaultService, { VaultConfig, VaultFile, LockType } from "@/services/VaultService";
import { Image } from "expo-image";

type VaultScreenNavigationProp = NativeStackNavigationProp<HomeStackParamList, "Vault">;

interface Props {
  navigation: VaultScreenNavigationProp;
}

type SetupStep = 'lock_type' | 'password' | 'security_question' | 'confirm';

interface LockTypeOption {
  id: LockType;
  labelKey: string;
  icon: keyof typeof Feather.glyphMap;
  description: string;
}

const LOCK_TYPES: LockTypeOption[] = [
  { id: 'pin', labelKey: 'vault.pinCode', icon: 'hash', description: 'Code numérique à 4-6 chiffres' },
  { id: 'password', labelKey: 'vault.password', icon: 'key', description: 'Mot de passe alphanumérique' },
  { id: 'pattern', labelKey: 'vault.pattern', icon: 'grid', description: 'Schéma de déverrouillage' },
];

type TabType = 'all' | 'images' | 'videos' | 'audio' | 'documents' | 'apps' | 'contacts';

interface TabItem {
  id: TabType;
  labelKey: string;
  icon: keyof typeof Feather.glyphMap;
}

const TABS: TabItem[] = [
  { id: 'all', labelKey: 'vault.allFiles', icon: 'folder' },
  { id: 'images', labelKey: 'vault.photos', icon: 'image' },
  { id: 'videos', labelKey: 'vault.videos', icon: 'video' },
  { id: 'audio', labelKey: 'vault.music', icon: 'music' },
  { id: 'documents', labelKey: 'vault.documents', icon: 'file-text' },
  { id: 'apps', labelKey: 'vault.apps', icon: 'grid' },
  { id: 'contacts', labelKey: 'vault.contacts', icon: 'users' },
];

export default function VaultScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, isDark, accentColor } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [isConfigured, setIsConfigured] = useState(false);
  const [isLocked, setIsLocked] = useState(true);
  const [config, setConfig] = useState<VaultConfig | null>(null);
  const [files, setFiles] = useState<VaultFile[]>([]);

  const [showSetupModal, setShowSetupModal] = useState(false);
  const [showUnlockModal, setShowUnlockModal] = useState(false);
  const [showRecoveryModal, setShowRecoveryModal] = useState(false);

  const [setupStep, setSetupStep] = useState<SetupStep>('lock_type');
  const [selectedLockType, setSelectedLockType] = useState<LockType>('pin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityQuestionIndex, setSecurityQuestionIndex] = useState(0);
  const [securityAnswer, setSecurityAnswer] = useState('');
  const [unlockInput, setUnlockInput] = useState('');
  const [unlockError, setUnlockError] = useState('');
  const [recoveryAnswer, setRecoveryAnswer] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');

  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());

  const securityQuestions = VaultService.getSecurityQuestions();

  const loadVaultState = useCallback(async () => {
    setIsLoading(true);
    try {
      await VaultService.initialize();
      const configured = await VaultService.isConfigured();
      setIsConfigured(configured);

      if (configured) {
        const vaultConfig = await VaultService.getConfig();
        setConfig(vaultConfig);
        
        const lockState = await VaultService.getLockState();
        setIsLocked(lockState.isLocked);

        if (!lockState.isLocked) {
          const vaultFiles = await VaultService.getFiles();
          setFiles(vaultFiles);
        }
      }
    } catch (error) {
      console.error('Error loading vault state:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadVaultState();
    }, [loadVaultState])
  );

  useEffect(() => {
    if (!isConfigured && !isLoading) {
      setShowSetupModal(true);
    } else if (isConfigured && isLocked && !isLoading) {
      setShowUnlockModal(true);
    }
  }, [isConfigured, isLocked, isLoading]);

  const handleSetupComplete = async () => {
    if (password !== confirmPassword) {
      Alert.alert(t('common.error'), t('vault.passwordsNotMatch'));
      return;
    }

    if (password.length < 4) {
      Alert.alert(t('common.error'), t('vault.passwordTooShort'));
      return;
    }

    if (!securityAnswer.trim()) {
      Alert.alert(t('common.error'), t('vault.securityAnswerRequired'));
      return;
    }

    const success = await VaultService.configureVault(
      selectedLockType,
      password,
      securityQuestions[securityQuestionIndex],
      securityAnswer
    );

    if (success) {
      setShowSetupModal(false);
      setIsConfigured(true);
      setShowUnlockModal(true);
      resetSetupState();
    } else {
      Alert.alert(t('common.error'), t('vault.setupFailed'));
    }
  };

  const resetSetupState = () => {
    setSetupStep('lock_type');
    setSelectedLockType('pin');
    setPassword('');
    setConfirmPassword('');
    setSecurityQuestionIndex(0);
    setSecurityAnswer('');
  };

  const handleUnlock = async () => {
    const result = await VaultService.unlock(unlockInput);

    if (result.success) {
      setIsLocked(false);
      setShowUnlockModal(false);
      setUnlockInput('');
      setUnlockError('');
      
      const vaultFiles = await VaultService.getFiles();
      setFiles(vaultFiles);
    } else {
      setUnlockError(result.error || t('vault.unlockFailed'));
    }
  };

  const handleRecovery = async () => {
    if (newPassword !== confirmNewPassword) {
      Alert.alert(t('common.error'), t('vault.passwordsNotMatch'));
      return;
    }

    if (newPassword.length < 4) {
      Alert.alert(t('common.error'), t('vault.passwordTooShort'));
      return;
    }

    const result = await VaultService.resetPassword(recoveryAnswer, newPassword);

    if (result.success) {
      setShowRecoveryModal(false);
      setShowUnlockModal(true);
      setRecoveryAnswer('');
      setNewPassword('');
      setConfirmNewPassword('');
      Alert.alert(t('common.success'), t('vault.passwordReset'));
    } else {
      Alert.alert(t('common.error'), result.error || t('vault.recoveryFailed'));
    }
  };

  const handleLockVault = async () => {
    await VaultService.lock();
    setIsLocked(true);
    setFiles([]);
    navigation.goBack();
  };

  const getFilteredFiles = (): VaultFile[] => {
    if (activeTab === 'all') return files;
    
    const typeMap: Record<TabType, VaultFile['type'] | undefined> = {
      'all': undefined,
      'images': 'image',
      'videos': 'video',
      'audio': 'audio',
      'documents': 'document',
      'apps': 'app',
      'contacts': 'contact',
    };

    const type = typeMap[activeTab];
    return type ? files.filter(f => f.type === type) : files;
  };

  const handleDeleteSelected = async () => {
    if (selectedFiles.size === 0) return;

    Alert.alert(
      t('vault.deleteConfirmTitle'),
      t('vault.deleteConfirmMessage', { count: selectedFiles.size }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: async () => {
            const removed = await VaultService.removeFiles(Array.from(selectedFiles));
            if (removed > 0) {
              const updatedFiles = await VaultService.getFiles();
              setFiles(updatedFiles);
              setSelectedFiles(new Set());
              setIsSelectionMode(false);
            }
          },
        },
      ]
    );
  };

  const renderFileItem = ({ item }: { item: VaultFile }) => {
    const isSelected = selectedFiles.has(item.id);

    return (
      <Pressable
        style={[
          styles.fileItem,
          { backgroundColor: theme.backgroundDefault },
          isSelected && { backgroundColor: theme.backgroundSecondary },
        ]}
        onPress={() => {
          if (isSelectionMode) {
            setSelectedFiles(prev => {
              const newSet = new Set(prev);
              if (newSet.has(item.id)) {
                newSet.delete(item.id);
              } else {
                newSet.add(item.id);
              }
              return newSet;
            });
          }
        }}
        onLongPress={() => {
          setIsSelectionMode(true);
          setSelectedFiles(new Set([item.id]));
        }}
      >
        {isSelectionMode ? (
          <View style={[styles.checkbox, isSelected && { backgroundColor: accentColor, borderColor: accentColor }]}>
            {isSelected ? <Feather name="check" size={14} color="#FFF" /> : null}
          </View>
        ) : null}
        
        {item.thumbnailUri ? (
          <Image source={{ uri: item.thumbnailUri }} style={styles.fileThumbnail} contentFit="cover" />
        ) : (
          <View style={[styles.fileIconContainer, { backgroundColor: theme.backgroundTertiary }]}>
            <Feather 
              name={getFileIcon(item.type)} 
              size={24} 
              color={getFileColor(item.type)} 
            />
          </View>
        )}

        <View style={styles.fileInfo}>
          <Text style={[styles.fileName, { color: theme.text }]} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={[styles.fileDetails, { color: theme.textSecondary }]}>
            {formatFileSize(item.size)}
          </Text>
        </View>
      </Pressable>
    );
  };

  const getFileIcon = (type: VaultFile['type']): keyof typeof Feather.glyphMap => {
    const icons: Record<VaultFile['type'], keyof typeof Feather.glyphMap> = {
      'image': 'image',
      'video': 'video',
      'audio': 'music',
      'document': 'file-text',
      'app': 'grid',
      'contact': 'user',
      'other': 'file',
    };
    return icons[type] || 'file';
  };

  const getFileColor = (type: VaultFile['type']): string => {
    const colors: Record<VaultFile['type'], string> = {
      'image': '#4CAF50',
      'video': '#E91E63',
      'audio': '#9C27B0',
      'document': '#2196F3',
      'app': '#FF9800',
      'contact': '#00BCD4',
      'other': '#607D8B',
    };
    return colors[type] || '#607D8B';
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
  };

  const renderSetupModal = () => (
    <Modal
      visible={showSetupModal}
      animationType="slide"
      transparent
      onRequestClose={() => {
        if (isConfigured) {
          setShowSetupModal(false);
        } else {
          navigation.goBack();
        }
      }}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t('vault.setupTitle')}
            </Text>
            <Pressable onPress={() => navigation.goBack()}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          {setupStep === 'lock_type' ? (
            <View style={styles.setupStepContainer}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                {t('vault.chooseLockType')}
              </Text>
              {LOCK_TYPES.map((lockType) => (
                <Pressable
                  key={lockType.id}
                  style={[
                    styles.lockTypeOption,
                    { backgroundColor: theme.backgroundSecondary },
                    selectedLockType === lockType.id && { borderColor: accentColor, borderWidth: 2 },
                  ]}
                  onPress={() => setSelectedLockType(lockType.id)}
                >
                  <View style={[styles.lockTypeIcon, { backgroundColor: accentColor }]}>
                    <Feather name={lockType.icon} size={24} color="#FFF" />
                  </View>
                  <View style={styles.lockTypeInfo}>
                    <Text style={[styles.lockTypeLabel, { color: theme.text }]}>
                      {t(lockType.labelKey)}
                    </Text>
                    <Text style={[styles.lockTypeDesc, { color: theme.textSecondary }]}>
                      {lockType.description}
                    </Text>
                  </View>
                  {selectedLockType === lockType.id ? (
                    <Feather name="check-circle" size={24} color={accentColor} />
                  ) : null}
                </Pressable>
              ))}
              <Pressable
                style={[styles.primaryButton, { backgroundColor: accentColor }]}
                onPress={() => setSetupStep('password')}
              >
                <Text style={styles.primaryButtonText}>{t('common.next')}</Text>
              </Pressable>
            </View>
          ) : null}

          {setupStep === 'password' ? (
            <View style={styles.setupStepContainer}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                {selectedLockType === 'pin' ? t('vault.enterPin') : t('vault.enterPassword')}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder={selectedLockType === 'pin' ? t('vault.pinPlaceholder') : t('vault.passwordPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                keyboardType={selectedLockType === 'pin' ? 'number-pad' : 'default'}
                maxLength={selectedLockType === 'pin' ? 6 : 32}
              />
              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder={t('vault.confirmPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                secureTextEntry
                keyboardType={selectedLockType === 'pin' ? 'number-pad' : 'default'}
                maxLength={selectedLockType === 'pin' ? 6 : 32}
              />
              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={() => setSetupStep('lock_type')}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t('common.back')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: accentColor, flex: 1, marginLeft: 12 }]}
                  onPress={() => {
                    if (password.length < 4) {
                      Alert.alert(t('common.error'), t('vault.passwordTooShort'));
                      return;
                    }
                    if (password !== confirmPassword) {
                      Alert.alert(t('common.error'), t('vault.passwordsNotMatch'));
                      return;
                    }
                    setSetupStep('security_question');
                  }}
                >
                  <Text style={styles.primaryButtonText}>{t('common.next')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {setupStep === 'security_question' ? (
            <View style={styles.setupStepContainer}>
              <Text style={[styles.stepTitle, { color: theme.text }]}>
                {t('vault.securityQuestionTitle')}
              </Text>
              <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
                {t('vault.securityQuestionDesc')}
              </Text>
              
              <View style={styles.questionSelector}>
                <Pressable
                  style={[styles.questionArrow, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => setSecurityQuestionIndex(prev => prev > 0 ? prev - 1 : securityQuestions.length - 1)}
                >
                  <Feather name="chevron-left" size={20} color={theme.text} />
                </Pressable>
                <Text style={[styles.selectedQuestion, { color: theme.text }]} numberOfLines={2}>
                  {securityQuestions[securityQuestionIndex]}
                </Text>
                <Pressable
                  style={[styles.questionArrow, { backgroundColor: theme.backgroundSecondary }]}
                  onPress={() => setSecurityQuestionIndex(prev => (prev + 1) % securityQuestions.length)}
                >
                  <Feather name="chevron-right" size={20} color={theme.text} />
                </Pressable>
              </View>

              <TextInput
                style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
                placeholder={t('vault.answerPlaceholder')}
                placeholderTextColor={theme.textSecondary}
                value={securityAnswer}
                onChangeText={setSecurityAnswer}
              />

              <View style={styles.buttonRow}>
                <Pressable
                  style={[styles.secondaryButton, { borderColor: theme.border }]}
                  onPress={() => setSetupStep('password')}
                >
                  <Text style={[styles.secondaryButtonText, { color: theme.text }]}>{t('common.back')}</Text>
                </Pressable>
                <Pressable
                  style={[styles.primaryButton, { backgroundColor: accentColor, flex: 1, marginLeft: 12 }]}
                  onPress={handleSetupComplete}
                >
                  <Text style={styles.primaryButtonText}>{t('common.finish')}</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </Animated.View>
      </View>
    </Modal>
  );

  const renderUnlockModal = () => (
    <Modal
      visible={showUnlockModal}
      animationType="fade"
      transparent
      onRequestClose={() => navigation.goBack()}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          entering={FadeIn}
          exiting={FadeOut}
          style={[styles.unlockModalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={[styles.lockIconContainer, { backgroundColor: accentColor }]}>
            <Feather name="lock" size={48} color="#FFF" />
          </View>
          
          <Text style={[styles.unlockTitle, { color: theme.text }]}>
            {t('vault.enterPassword')}
          </Text>
          
          <TextInput
            style={[styles.unlockInput, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
            placeholder={config?.lockType === 'pin' ? "••••" : t('vault.passwordPlaceholder')}
            placeholderTextColor={theme.textSecondary}
            value={unlockInput}
            onChangeText={(text) => {
              setUnlockInput(text);
              setUnlockError('');
            }}
            secureTextEntry
            keyboardType={config?.lockType === 'pin' ? 'number-pad' : 'default'}
            autoFocus
          />

          {unlockError ? (
            <Text style={[styles.errorText, { color: theme.error }]}>{unlockError}</Text>
          ) : null}

          <Pressable
            style={[styles.unlockButton, { backgroundColor: accentColor }]}
            onPress={handleUnlock}
          >
            <Text style={styles.unlockButtonText}>{t('vault.unlock')}</Text>
          </Pressable>

          <Pressable
            style={styles.forgotPasswordLink}
            onPress={() => {
              setShowUnlockModal(false);
              setShowRecoveryModal(true);
            }}
          >
            <Text style={[styles.forgotPasswordText, { color: accentColor }]}>
              {t('vault.forgotPassword')}
            </Text>
          </Pressable>

          <Pressable
            style={styles.cancelLink}
            onPress={() => navigation.goBack()}
          >
            <Text style={[styles.cancelLinkText, { color: theme.textSecondary }]}>
              {t('common.cancel')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );

  const renderRecoveryModal = () => (
    <Modal
      visible={showRecoveryModal}
      animationType="slide"
      transparent
      onRequestClose={() => {
        setShowRecoveryModal(false);
        setShowUnlockModal(true);
      }}
    >
      <View style={styles.modalOverlay}>
        <Animated.View 
          entering={SlideInDown}
          exiting={SlideOutDown}
          style={[styles.modalContent, { backgroundColor: theme.backgroundDefault }]}
        >
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>
              {t('vault.recoveryTitle')}
            </Text>
            <Pressable onPress={() => {
              setShowRecoveryModal(false);
              setShowUnlockModal(true);
            }}>
              <Feather name="x" size={24} color={theme.text} />
            </Pressable>
          </View>

          <View style={styles.setupStepContainer}>
            <Text style={[styles.stepDescription, { color: theme.textSecondary }]}>
              {config?.securityQuestion}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder={t('vault.answerPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={recoveryAnswer}
              onChangeText={setRecoveryAnswer}
            />

            <Text style={[styles.stepTitle, { color: theme.text, marginTop: 20 }]}>
              {t('vault.newPassword')}
            </Text>

            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder={t('vault.passwordPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={newPassword}
              onChangeText={setNewPassword}
              secureTextEntry
            />

            <TextInput
              style={[styles.input, { backgroundColor: theme.backgroundSecondary, color: theme.text }]}
              placeholder={t('vault.confirmPlaceholder')}
              placeholderTextColor={theme.textSecondary}
              value={confirmNewPassword}
              onChangeText={setConfirmNewPassword}
              secureTextEntry
            />

            <Pressable
              style={[styles.primaryButton, { backgroundColor: accentColor }]}
              onPress={handleRecovery}
            >
              <Text style={styles.primaryButtonText}>{t('vault.resetPassword')}</Text>
            </Pressable>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
            <Feather name="arrow-left" size={24} color={theme.text} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.text }]}>{t('vault.title')}</Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
        </View>
      </View>
    );
  }

  const filteredFiles = getFilteredFiles();

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
          <Feather name="arrow-left" size={24} color={theme.text} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t('vault.title')}</Text>
        <View style={styles.headerRight}>
          {isSelectionMode ? (
            <Pressable onPress={() => {
              setIsSelectionMode(false);
              setSelectedFiles(new Set());
            }}>
              <Text style={[styles.cancelText, { color: accentColor }]}>{t('common.cancel')}</Text>
            </Pressable>
          ) : (
            <Pressable onPress={handleLockVault}>
              <Feather name="lock" size={22} color={theme.text} />
            </Pressable>
          )}
        </View>
      </View>

      <FlatList
        horizontal
        showsHorizontalScrollIndicator={false}
        data={TABS}
        keyExtractor={(item) => item.id}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabsContent}
        renderItem={({ item }) => (
          <Pressable
            style={[
              styles.tab,
              { backgroundColor: activeTab === item.id ? accentColor : theme.backgroundSecondary },
            ]}
            onPress={() => setActiveTab(item.id)}
          >
            <Feather 
              name={item.icon} 
              size={16} 
              color={activeTab === item.id ? '#FFF' : theme.textSecondary} 
            />
            <Text 
              style={[
                styles.tabLabel, 
                { color: activeTab === item.id ? '#FFF' : theme.textSecondary }
              ]}
            >
              {t(item.labelKey)}
            </Text>
          </Pressable>
        )}
      />

      {filteredFiles.length === 0 ? (
        <View style={styles.emptyContainer}>
          <View style={[styles.emptyIcon, { backgroundColor: theme.backgroundSecondary }]}>
            <Feather name="lock" size={48} color={theme.textSecondary} />
          </View>
          <Text style={[styles.emptyTitle, { color: theme.text }]}>
            {t('vault.emptyTitle')}
          </Text>
          <Text style={[styles.emptyDescription, { color: theme.textSecondary }]}>
            {t('vault.emptyDescription')}
          </Text>
          <Pressable
            style={[styles.addButton, { backgroundColor: accentColor }]}
            onPress={() => navigation.navigate("FileSelection")}
          >
            <Feather name="plus" size={20} color="#FFF" />
            <Text style={styles.addButtonText}>{t('vault.addFiles')}</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filteredFiles}
          keyExtractor={(item) => item.id}
          renderItem={renderFileItem}
          contentContainerStyle={[styles.filesList, { paddingBottom: insets.bottom + 80 }]}
          showsVerticalScrollIndicator={false}
        />
      )}

      {isSelectionMode && selectedFiles.size > 0 ? (
        <View style={[styles.selectionBar, { backgroundColor: theme.backgroundDefault, paddingBottom: insets.bottom + 16 }]}>
          <Text style={[styles.selectionCount, { color: theme.text }]}>
            {t('vault.selectedCount', { count: selectedFiles.size })}
          </Text>
          <Pressable
            style={[styles.deleteButton, { backgroundColor: theme.error }]}
            onPress={handleDeleteSelected}
          >
            <Feather name="trash-2" size={20} color="#FFF" />
            <Text style={styles.deleteButtonText}>{t('common.delete')}</Text>
          </Pressable>
        </View>
      ) : null}

      {!isSelectionMode && !isLocked && files.length > 0 ? (
        <Pressable
          style={[styles.fab, { backgroundColor: accentColor, bottom: insets.bottom + 20 }]}
          onPress={() => navigation.navigate("FileSelection")}
        >
          <Feather name="plus" size={24} color="#FFF" />
        </Pressable>
      ) : null}

      {renderSetupModal()}
      {renderUnlockModal()}
      {renderRecoveryModal()}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  headerRight: {
    width: 40,
    alignItems: 'flex-end',
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  tabsContainer: {
    maxHeight: 50,
  },
  tabsContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 20,
    gap: 6,
    marginRight: 8,
  },
  tabLabel: {
    fontSize: 13,
    fontWeight: '500',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  emptyIcon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 24,
    lineHeight: 20,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  filesList: {
    padding: 16,
  },
  fileItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#CCC',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileThumbnail: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  fileIconContainer: {
    width: 48,
    height: 48,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  fileDetails: {
    fontSize: 12,
  },
  selectionBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
  },
  selectionCount: {
    fontSize: 16,
    fontWeight: '500',
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  deleteButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingBottom: 40,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '600',
  },
  setupStepContainer: {
    padding: 20,
  },
  stepTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  stepDescription: {
    fontSize: 14,
    marginBottom: 20,
    lineHeight: 20,
  },
  lockTypeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  lockTypeIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  lockTypeInfo: {
    flex: 1,
  },
  lockTypeLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  lockTypeDesc: {
    fontSize: 13,
  },
  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 16,
    marginBottom: 12,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 8,
  },
  primaryButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 16,
  },
  primaryButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  secondaryButton: {
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    paddingHorizontal: 24,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '500',
  },
  questionSelector: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  questionArrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  selectedQuestion: {
    flex: 1,
    fontSize: 15,
    textAlign: 'center',
    paddingHorizontal: 12,
    lineHeight: 22,
  },
  unlockModalContent: {
    margin: 24,
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
  },
  lockIconContainer: {
    width: 96,
    height: 96,
    borderRadius: 48,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  unlockTitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 24,
  },
  unlockInput: {
    width: '100%',
    height: 56,
    borderRadius: 12,
    paddingHorizontal: 20,
    fontSize: 20,
    textAlign: 'center',
    letterSpacing: 8,
  },
  errorText: {
    marginTop: 12,
    fontSize: 14,
    textAlign: 'center',
  },
  unlockButton: {
    width: '100%',
    height: 50,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  unlockButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  forgotPasswordLink: {
    marginTop: 16,
  },
  forgotPasswordText: {
    fontSize: 14,
    fontWeight: '500',
  },
  cancelLink: {
    marginTop: 12,
  },
  cancelLinkText: {
    fontSize: 14,
  },
});
