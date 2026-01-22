import React, { useState, useMemo } from "react";
import {
  View,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
  ScrollView,
} from "react-native";
import { Image } from "expo-image";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from "react-native-reanimated";
import { AuthService } from "@/services/AuthService";
import { useTheme } from "@/hooks/useTheme";
import { useTranslation } from "react-i18next";

type AuthScreenNavigationProp = NativeStackNavigationProp<any, "Auth">;

interface Props {
  navigation: AuthScreenNavigationProp;
}

type AuthMode = "signin" | "signup";
type MobileProvider = "mtn" | "airtel";

interface PasswordStrength {
  level: "weak" | "medium" | "strong";
  labelKey: string;
  color: string;
  percentage: number;
}

const getPasswordStrength = (password: string): PasswordStrength => {
  let score = 0;
  
  if (password.length >= 6) score += 1;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[a-z]/.test(password)) score += 1;
  if (/[A-Z]/.test(password)) score += 1;
  if (/[0-9]/.test(password)) score += 1;
  if (/[^a-zA-Z0-9]/.test(password)) score += 1;

  if (score <= 2) {
    return { level: "weak", labelKey: "auth.passwordStrength.weak", color: "#EF4444", percentage: 33 };
  } else if (score <= 4) {
    return { level: "medium", labelKey: "auth.passwordStrength.medium", color: "#F59E0B", percentage: 66 };
  } else {
    return { level: "strong", labelKey: "auth.passwordStrength.strong", color: "#22C55E", percentage: 100 };
  }
};

export default function AuthScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { theme, isDark, accentColor } = useTheme();
  const [mode, setMode] = useState<AuthMode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [mobileProvider, setMobileProvider] = useState<MobileProvider>("mtn");

  const buttonScale = useSharedValue(1);

  const passwordStrength = useMemo(() => {
    if (!password) return null;
    return getPasswordStrength(password);
  }, [password]);

  const buttonAnimatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: buttonScale.value }],
  }));

  const handlePressIn = () => {
    buttonScale.value = withSpring(0.95, { damping: 15, stiffness: 400 });
  };

  const handlePressOut = () => {
    buttonScale.value = withSpring(1, { damping: 15, stiffness: 400 });
  };

  const validateForm = (): boolean => {
    setError(null);

    if (mode === "signup") {
      if (!fullName.trim()) {
        setError(t('auth.enterFullName'));
        return false;
      }
      
      if (!username.trim()) {
        setError(t('auth.enterUsername'));
        return false;
      }
      
      if (username.includes(" ")) {
        setError(t('auth.usernameNoSpaces'));
        return false;
      }
      
      if (!phoneNumber.trim()) {
        setError(t('auth.enterMobileNumber'));
        return false;
      }
      
      const cleanPhone = phoneNumber.replace(/\s/g, "");
      if (cleanPhone.length < 6 || cleanPhone.length > 10) {
        setError(t('auth.invalidPhoneNumber'));
        return false;
      }
      if (!/^[0-9]+$/.test(cleanPhone)) {
        setError(t('auth.phoneOnlyDigits'));
        return false;
      }
    }

    if (!email.trim()) {
      setError(t('auth.enterEmail'));
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      setError(t('auth.invalidEmail'));
      return false;
    }

    if (!password) {
      setError(t('auth.enterPassword'));
      return false;
    }

    if (password.length < 6) {
      setError(t('auth.passwordMinLength'));
      return false;
    }

    if (mode === "signup" && password !== confirmPassword) {
      setError(t('auth.passwordsNoMatch'));
      return false;
    }

    return true;
  };

  const handleAuth = async () => {
    if (!validateForm()) return;

    setIsLoading(true);
    setError(null);

    try {
      const result =
        mode === "signin"
          ? await AuthService.signIn(email, password)
          : await AuthService.signUp({
              email,
              password,
              fullName,
              username,
              phoneNumber: phoneNumber.replace(/\s/g, ""),
              mobileProvider,
            });

      if (result.success) {
        if (mode === "signup") {
          Alert.alert(
            t('auth.registrationSuccess'),
            t('auth.checkEmail'),
            [{ text: "OK", onPress: () => setMode("signin") }]
          );
        } else {
          navigation.goBack();
        }
      } else {
        setError(result.error || t('auth.errorOccurred'));
      }
    } catch (err) {
      setError(t('auth.unexpectedError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      Alert.alert(t('auth.emailRequired'), t('auth.enterEmailForReset'));
      return;
    }

    setIsLoading(true);
    const result = await AuthService.resetPassword(email);
    setIsLoading(false);

    if (result.success) {
      Alert.alert(
        t('auth.emailSent'),
        t('auth.checkInboxForReset')
      );
    } else {
      Alert.alert(t('common.error'), result.error || t('auth.unableToSendEmail'));
    }
  };

  const toggleMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setPassword("");
    setConfirmPassword("");
    setFullName("");
    setUsername("");
    setPhoneNumber("");
  };

  const getStrengthHint = () => {
    if (!passwordStrength) return "";
    if (passwordStrength.level === "weak") return t('auth.passwordStrength.addUpperAndSymbols');
    if (passwordStrength.level === "medium") return t('auth.passwordStrength.addSymbols');
    return t('auth.passwordStrength.excellent');
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top, backgroundColor: theme.backgroundDefault }]}>
      <Pressable 
        style={[styles.closeButton, { top: insets.top + 12 }]} 
        onPress={() => navigation.goBack()}
      >
        <View style={[styles.closeButtonInner, { backgroundColor: theme.backgroundSecondary }]}>
          <Feather name="x" size={20} color={theme.text} />
        </View>
      </Pressable>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <Animated.View entering={FadeInDown.delay(100).duration(600)} style={styles.illustrationContainer}>
            <Image
              source={require("@/assets/images/auth-illustration.png")}
              style={styles.illustration}
              contentFit="contain"
            />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(200).duration(600)} style={styles.headerContent}>
            <Text style={[styles.title, { color: theme.text }]}>
              {mode === "signin" ? t('auth.welcomeBack') : t('auth.createAccount')}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {mode === "signin"
                ? t('auth.signInSubtitle')
                : t('auth.signUpSubtitle')}
            </Text>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.formContainer}>
            {error ? (
              <Animated.View entering={FadeIn.duration(300)} style={[styles.errorContainer, { backgroundColor: isDark ? 'rgba(239, 68, 68, 0.15)' : '#FEF2F2' }]}>
                <Feather name="alert-circle" size={16} color={theme.error} />
                <Text style={[styles.errorText, { color: theme.error }]}>{error}</Text>
              </Animated.View>
            ) : null}

            {mode === "signup" ? (
              <>
                <Animated.View entering={FadeInDown.duration(300)} style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Feather name="user" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={t('auth.fullName')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="words"
                    value={fullName}
                    onChangeText={setFullName}
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(50).duration(300)} style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                  <Feather name="at-sign" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                  <TextInput
                    style={[styles.input, { color: theme.text }]}
                    placeholder={t('profile.username')}
                    placeholderTextColor={theme.textSecondary}
                    autoCapitalize="none"
                    autoCorrect={false}
                    value={username}
                    onChangeText={(text) => setUsername(text.toLowerCase().replace(/\s/g, ""))}
                  />
                </Animated.View>

                <Animated.View entering={FadeInDown.delay(100).duration(300)}>
                  <View style={styles.providerSelector}>
                    <Pressable
                      style={[
                        styles.providerOption,
                        { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                        mobileProvider === "mtn" && { borderColor: accentColor, backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' },
                      ]}
                      onPress={() => setMobileProvider("mtn")}
                    >
                      <View style={[styles.providerDot, { backgroundColor: "#FFCC00" }]} />
                      <Text style={[
                        styles.providerText,
                        { color: theme.textSecondary },
                        mobileProvider === "mtn" && { color: accentColor }
                      ]}>MTN MoMo</Text>
                    </Pressable>
                    <Pressable
                      style={[
                        styles.providerOption,
                        { backgroundColor: theme.backgroundSecondary, borderColor: theme.border },
                        mobileProvider === "airtel" && { borderColor: accentColor, backgroundColor: isDark ? 'rgba(37, 99, 235, 0.15)' : '#EFF6FF' },
                      ]}
                      onPress={() => setMobileProvider("airtel")}
                    >
                      <View style={[styles.providerDot, { backgroundColor: "#E4002B" }]} />
                      <Text style={[
                        styles.providerText,
                        { color: theme.textSecondary },
                        mobileProvider === "airtel" && { color: accentColor }
                      ]}>Airtel Money</Text>
                    </Pressable>
                  </View>
                  
                  <View style={styles.phoneInputContainer}>
                    <View style={[styles.phonePrefix, { backgroundColor: theme.backgroundTertiary, borderColor: theme.border }]}>
                      <Text style={[styles.phonePrefixText, { color: theme.text }]}>+242</Text>
                    </View>
                    <View style={[styles.phoneInputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                      <Feather name="smartphone" size={18} color={theme.textSecondary} style={styles.phoneIcon} />
                      <TextInput
                        style={[styles.phoneInput, { color: theme.text }]}
                        placeholder={mobileProvider === "mtn" ? "06X XXX XXX" : "05X XXX XXX"}
                        placeholderTextColor={theme.textSecondary}
                        keyboardType="phone-pad"
                        value={phoneNumber}
                        onChangeText={setPhoneNumber}
                        maxLength={10}
                      />
                    </View>
                  </View>
                </Animated.View>
              </>
            ) : null}

            <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
              <Feather name="mail" size={20} color={theme.textSecondary} style={styles.inputIcon} />
              <TextInput
                style={[styles.input, { color: theme.text }]}
                placeholder={t('auth.email')}
                placeholderTextColor={theme.textSecondary}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                value={email}
                onChangeText={setEmail}
              />
            </View>

            {mode === "signup" ? (
              <Animated.View entering={FadeInDown.delay(150).duration(300)}>
                <View style={styles.passwordRow}>
                  <View style={[styles.inputWrapper, styles.passwordHalf, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <Feather name="lock" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.inputSmall, { color: theme.text }]}
                      placeholder={t('auth.password')}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showPassword}
                      value={password}
                      onChangeText={setPassword}
                    />
                    <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButtonSmall}>
                      <Feather name={showPassword ? "eye-off" : "eye"} size={16} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                  
                  <View style={[styles.inputWrapper, styles.passwordHalf, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                    <Feather name="check-circle" size={18} color={theme.textSecondary} style={styles.inputIcon} />
                    <TextInput
                      style={[styles.inputSmall, { color: theme.text }]}
                      placeholder={t('auth.confirmPassword')}
                      placeholderTextColor={theme.textSecondary}
                      secureTextEntry={!showConfirmPassword}
                      value={confirmPassword}
                      onChangeText={setConfirmPassword}
                    />
                    <Pressable onPress={() => setShowConfirmPassword(!showConfirmPassword)} style={styles.eyeButtonSmall}>
                      <Feather name={showConfirmPassword ? "eye-off" : "eye"} size={16} color={theme.textSecondary} />
                    </Pressable>
                  </View>
                </View>

                {passwordStrength ? (
                  <Animated.View entering={FadeIn.duration(200)} style={styles.strengthContainer}>
                    <View style={[styles.strengthBarContainer, { backgroundColor: theme.border }]}>
                      <View 
                        style={[
                          styles.strengthBar, 
                          { 
                            width: `${passwordStrength.percentage}%`,
                            backgroundColor: passwordStrength.color 
                          }
                        ]} 
                      />
                    </View>
                    <View style={styles.strengthLabelContainer}>
                      <Feather 
                        name={passwordStrength.level === "strong" ? "shield" : passwordStrength.level === "medium" ? "alert-triangle" : "alert-circle"} 
                        size={14} 
                        color={passwordStrength.color} 
                      />
                      <Text style={[styles.strengthText, { color: passwordStrength.color }]}>
                        {t(passwordStrength.labelKey)}
                      </Text>
                      <Text style={[styles.strengthHint, { color: theme.textSecondary }]}>
                        {getStrengthHint()}
                      </Text>
                    </View>
                  </Animated.View>
                ) : null}
              </Animated.View>
            ) : (
              <View style={[styles.inputWrapper, { backgroundColor: theme.backgroundSecondary, borderColor: theme.border }]}>
                <Feather name="lock" size={20} color={theme.textSecondary} style={styles.inputIcon} />
                <TextInput
                  style={[styles.input, { color: theme.text }]}
                  placeholder={t('auth.password')}
                  placeholderTextColor={theme.textSecondary}
                  secureTextEntry={!showPassword}
                  value={password}
                  onChangeText={setPassword}
                />
                <Pressable onPress={() => setShowPassword(!showPassword)} style={styles.eyeButton}>
                  <Feather name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textSecondary} />
                </Pressable>
              </View>
            )}

            {mode === "signin" ? (
              <Pressable onPress={handleForgotPassword} style={styles.forgotButton}>
                <Text style={[styles.forgotText, { color: accentColor }]}>{t('auth.forgotPassword')}</Text>
              </Pressable>
            ) : null}

            <Animated.View style={buttonAnimatedStyle}>
              <Pressable
                style={[styles.submitButton, { backgroundColor: accentColor }, isLoading && styles.submitButtonDisabled]}
                onPress={handleAuth}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={isLoading}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <>
                    <Text style={styles.submitButtonText}>
                      {mode === "signin" ? t('auth.signIn') : t('auth.signUp')}
                    </Text>
                    <Feather name="arrow-right" size={20} color="#FFF" />
                  </>
                )}
              </Pressable>
            </Animated.View>

            <View style={styles.switchContainer}>
              <Text style={[styles.switchText, { color: theme.textSecondary }]}>
                {mode === "signin" ? t('auth.noAccount') : t('auth.haveAccount')}
              </Text>
              <Pressable onPress={toggleMode}>
                <Text style={[styles.switchLink, { color: accentColor }]}>
                  {mode === "signin" ? t('auth.signUp') : t('auth.signIn')}
                </Text>
              </Pressable>
            </View>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  closeButton: {
    position: "absolute",
    right: 16,
    zIndex: 10,
  },
  closeButtonInner: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: 20,
  },
  illustrationContainer: {
    alignItems: "center",
    marginTop: 32,
    marginBottom: 16,
  },
  illustration: {
    width: 160,
    height: 120,
  },
  headerContent: {
    alignItems: "center",
    marginBottom: 24,
  },
  title: {
    fontSize: 26,
    fontWeight: "700",
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },
  formContainer: {
    flex: 1,
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    gap: 8,
  },
  errorText: {
    fontSize: 13,
    flex: 1,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
    paddingHorizontal: 14,
    height: 52,
  },
  inputIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
  },
  inputSmall: {
    flex: 1,
    fontSize: 14,
  },
  eyeButton: {
    padding: 4,
  },
  eyeButtonSmall: {
    padding: 2,
  },
  providerSelector: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 10,
  },
  providerOption: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 1.5,
    gap: 8,
  },
  providerDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  providerText: {
    fontSize: 13,
    fontWeight: "500",
  },
  phoneInputContainer: {
    flexDirection: "row",
    marginBottom: 12,
    gap: 8,
  },
  phonePrefix: {
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
    justifyContent: "center",
    alignItems: "center",
  },
  phonePrefixText: {
    fontSize: 14,
    fontWeight: "600",
  },
  phoneInputWrapper: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 14,
    height: 52,
  },
  phoneIcon: {
    marginRight: 8,
  },
  phoneInput: {
    flex: 1,
    fontSize: 15,
  },
  passwordRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 0,
  },
  passwordHalf: {
    flex: 1,
    marginBottom: 12,
    paddingHorizontal: 10,
  },
  strengthContainer: {
    marginBottom: 12,
    gap: 6,
  },
  strengthBarContainer: {
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  strengthBar: {
    height: "100%",
    borderRadius: 2,
  },
  strengthLabelContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    flexWrap: "wrap",
  },
  strengthText: {
    fontSize: 12,
    fontWeight: "600",
  },
  strengthHint: {
    fontSize: 11,
    flex: 1,
  },
  forgotButton: {
    alignSelf: "flex-end",
    marginBottom: 16,
    paddingVertical: 4,
  },
  forgotText: {
    fontSize: 13,
    fontWeight: "500",
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 14,
    height: 52,
    gap: 8,
    marginBottom: 16,
  },
  submitButtonDisabled: {
    opacity: 0.7,
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#FFF",
  },
  switchContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  switchText: {
    fontSize: 14,
  },
  switchLink: {
    fontSize: 14,
    fontWeight: "600",
  },
});
