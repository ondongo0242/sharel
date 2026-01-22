import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Platform,
  ActivityIndicator,
  Alert,
  Dimensions,
} from "react-native";
import * as ExpoClipboard from "expo-clipboard";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTranslation } from "react-i18next";
import { useTheme } from "@/hooks/useTheme";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HomeStackParamList } from "@/navigation/HomeStackNavigator";
import { Spacing, BorderRadius } from "@/constants/theme";
import Svg, { Rect } from "react-native-svg";
import * as QRCode from "qrcode";
import HotspotService from "@/services/HotspotService";

type AppShareHotspotScreenNavigationProp = NativeStackNavigationProp<
  HomeStackParamList,
  "AppShareHotspot"
>;

interface Props {
  navigation: AppShareHotspotScreenNavigationProp;
}

interface HotspotConfig {
  ssid: string;
  password: string;
  ipAddress: string;
  port: number;
}

interface QRCodeMatrix {
  size: number;
  data: boolean[][];
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const QR_SIZE = Math.min(SCREEN_WIDTH * 0.5, 200);

const QRCodeDisplay = ({
  matrix,
  size,
  color,
  backgroundColor,
}: {
  matrix: QRCodeMatrix;
  size: number;
  color: string;
  backgroundColor: string;
}) => {
  const cellSize = size / matrix.size;

  return (
    <View
      style={[
        styles.qrCodeContainer,
        { backgroundColor, width: size, height: size },
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {matrix.data.map((row, rowIndex) =>
          row.map((cell, colIndex) =>
            cell ? (
              <Rect
                key={`${rowIndex}-${colIndex}`}
                x={colIndex * cellSize}
                y={rowIndex * cellSize}
                width={cellSize}
                height={cellSize}
                fill={color}
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
};

export default function AppShareHotspotScreen({ navigation }: Props) {
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const { theme, accentColor } = useTheme();

  const [isLoading, setIsLoading] = useState(true);
  const [hotspotConfig, setHotspotConfig] = useState<HotspotConfig | null>(null);
  const [qrMatrix, setQrMatrix] = useState<QRCodeMatrix | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateQRCode = useCallback((config: HotspotConfig) => {
    try {
      const downloadUrl = `http://${config.ipAddress}:${config.port}`;
      
      const qrPayload = {
        v: 1,
        type: "sharel_app_share",
        ssid: config.ssid,
        password: config.password,
        url: downloadUrl,
      };

      const qrData = QRCode.create(JSON.stringify(qrPayload), {
        errorCorrectionLevel: "L",
      });

      const modules = qrData.modules;
      const size = modules.size;
      const data: boolean[][] = [];

      for (let row = 0; row < size; row++) {
        const rowData: boolean[] = [];
        for (let col = 0; col < size; col++) {
          rowData.push(modules.get(row, col) === 1);
        }
        data.push(rowData);
      }

      setQrMatrix({ size, data });
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  }, []);

  const initializeHotspot = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      if (Platform.OS === "web") {
        setError(t("appShareHotspot.webNotSupported", "Le partage par point d'acc\u00e8s n'est pas disponible sur le web.\n\nCette fonctionnalit\u00e9 n\u00e9cessite l'application native (APK)."));
        setIsLoading(false);
        return;
      }

      const deviceName = "Share_" + Math.random().toString(36).substring(2, 6).toUpperCase();
      const hotspotInfo = await HotspotService.startHotspot(deviceName);
      
      const config: HotspotConfig = {
        ssid: hotspotInfo.ssid,
        password: hotspotInfo.password,
        ipAddress: hotspotInfo.ipAddress,
        port: hotspotInfo.port,
      };

      setHotspotConfig(config);
      generateQRCode(config);
    } catch (err: any) {
      console.error("Error initializing hotspot:", err);
      const errorMessage = err?.message || t("appShareHotspot.initError", "Erreur lors de l'initialisation");
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  }, [t, generateQRCode]);

  useEffect(() => {
    initializeHotspot();
  }, [initializeHotspot]);

  const copyToClipboard = async (text: string, label: string) => {
    try {
      await ExpoClipboard.setStringAsync(text);
      Alert.alert(t("common.copied", "Copi\u00e9"), `${label} ${t("common.copiedToClipboard", "copi\u00e9 dans le presse-papiers")}`);
    } catch (error) {
      console.error("Failed to copy to clipboard:", error);
    }
  };

  const handleRetry = () => {
    initializeHotspot();
  };

  if (isLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              backgroundColor: accentColor,
            },
          ]}
        >
          <Pressable
            style={[styles.backButton, { backgroundColor: `${theme.backgroundDefault}33` }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.buttonText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.buttonText }]}>
            {t("appShareHotspot.title", "Invitation du point d'acc\u00e8s")}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={accentColor} />
          <Text style={[styles.loadingText, { color: theme.textSecondary }]}>
            {t("appShareHotspot.initializing", "Initialisation...")}
          </Text>
        </View>
      </View>
    );
  }

  if (error || !hotspotConfig) {
    return (
      <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + 12,
              backgroundColor: accentColor,
            },
          ]}
        >
          <Pressable
            style={[styles.backButton, { backgroundColor: `${theme.backgroundDefault}33` }]}
            onPress={() => navigation.goBack()}
          >
            <Feather name="arrow-left" size={24} color={theme.buttonText} />
          </Pressable>
          <Text style={[styles.headerTitle, { color: theme.buttonText }]}>
            {t("appShareHotspot.title", "Invitation du point d'acc\u00e8s")}
          </Text>
          <View style={styles.headerRight} />
        </View>
        <View style={styles.errorContainer}>
          <Feather name="alert-circle" size={48} color={theme.error} />
          <Text style={[styles.errorText, { color: theme.text }]}>
            {error || t("appShareHotspot.unknownError", "Erreur inconnue")}
          </Text>
          <Pressable
            style={[styles.retryButton, { backgroundColor: accentColor }]}
            onPress={handleRetry}
          >
            <Text style={[styles.retryButtonText, { color: theme.buttonText }]}>
              {t("common.retry", "R\u00e9essayer")}
            </Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const downloadUrl = `http://${hotspotConfig.ipAddress}:${hotspotConfig.port}`;

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundRoot }]}>
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 12,
            backgroundColor: accentColor,
          },
        ]}
      >
        <Pressable
          style={[styles.backButton, { backgroundColor: `${theme.backgroundDefault}33` }]}
          onPress={() => navigation.goBack()}
        >
          <Feather name="arrow-left" size={24} color={theme.buttonText} />
        </Pressable>
        <Text style={[styles.headerTitle, { color: theme.buttonText }]}>
          {t("appShareHotspot.title", "Invitation du point d'acc\u00e8s")}
        </Text>
        <View style={styles.headerRight} />
      </View>

      <View style={[styles.content, { backgroundColor: theme.backgroundRoot }]}>
        <Text style={[styles.instructionsTitle, { color: theme.textSecondary }]}>
          {t("appShareHotspot.instructionsTitle", "Instructions pour les autres appareils.")}
        </Text>

        <View style={styles.step}>
          <Text style={[styles.stepNumber, { color: theme.text }]}>1.</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepText, { color: theme.text }]}>
              {t("appShareHotspot.step1", "Connectez-vous au r\u00e9seau Wi-Fi.")}
            </Text>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.text }]}>
                {t("appShareHotspot.name", "Nom")} :
              </Text>
              <Pressable onPress={() => copyToClipboard(hotspotConfig.ssid, "SSID")}>
                <Text style={[styles.infoValue, { color: accentColor }]}>
                  {hotspotConfig.ssid}
                </Text>
              </Pressable>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.text }]}>
                {t("appShareHotspot.password", "Mot de passe")} :
              </Text>
              <Pressable onPress={() => copyToClipboard(hotspotConfig.password, t("appShareHotspot.password", "Mot de passe"))}>
                <Text style={[styles.infoValue, { color: accentColor }]}>
                  {hotspotConfig.password}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>

        <View style={styles.step}>
          <Text style={[styles.stepNumber, { color: theme.text }]}>2.</Text>
          <Text style={[styles.stepText, { color: theme.text }]}>
            {t("appShareHotspot.step2", "Ouvrez le navigateur Web de l'appareil.")}
          </Text>
        </View>

        <View style={styles.step}>
          <Text style={[styles.stepNumber, { color: theme.text }]}>3.</Text>
          <View style={styles.stepContent}>
            <Text style={[styles.stepText, { color: theme.text }]}>
              {t("appShareHotspot.step3", "Saisissez l'adresse suivante.")}
            </Text>
            <Pressable onPress={() => copyToClipboard(downloadUrl, "URL")}>
              <Text style={[styles.urlText, { color: accentColor }]}>
                {downloadUrl}
              </Text>
            </Pressable>
            <Text style={[styles.noteText, { color: theme.textSecondary }]}>
              {t("appShareHotspot.note", 'Note: "http://" peut \u00eatre omis dans la plupart des cas')}
            </Text>
          </View>
        </View>

        <View style={styles.separator}>
          <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
          <Text style={[styles.separatorText, { color: theme.textSecondary }]}>
            {t("common.or", "OU")}
          </Text>
          <View style={[styles.separatorLine, { backgroundColor: theme.border }]} />
        </View>

        <View style={styles.qrSection}>
          {qrMatrix ? (
            <QRCodeDisplay
              matrix={qrMatrix}
              size={QR_SIZE}
              color={theme.text}
              backgroundColor={theme.backgroundDefault}
            />
          ) : (
            <View
              style={[
                styles.qrPlaceholder,
                { backgroundColor: theme.backgroundSecondary, width: QR_SIZE, height: QR_SIZE },
              ]}
            >
              <ActivityIndicator size="small" color={accentColor} />
            </View>
          )}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: {
    flex: 1,
    fontSize: 18,
    fontWeight: "600",
    textAlign: "center",
    marginHorizontal: Spacing.md,
  },
  headerRight: {
    width: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.xl,
    gap: Spacing.lg,
  },
  errorText: {
    fontSize: 16,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: "600",
  },
  content: {
    flex: 1,
    padding: Spacing.lg,
  },
  instructionsTitle: {
    fontSize: 14,
    marginBottom: Spacing.lg,
  },
  step: {
    flexDirection: "row",
    marginBottom: Spacing.lg,
  },
  stepNumber: {
    fontSize: 16,
    fontWeight: "600",
    marginRight: Spacing.sm,
    minWidth: 20,
  },
  stepContent: {
    flex: 1,
  },
  stepText: {
    fontSize: 16,
    lineHeight: 24,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: Spacing.xs,
    paddingLeft: Spacing.sm,
  },
  infoLabel: {
    fontSize: 14,
    marginRight: Spacing.sm,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "600",
  },
  urlText: {
    fontSize: 16,
    fontWeight: "600",
    marginTop: Spacing.xs,
  },
  noteText: {
    fontSize: 12,
    marginTop: Spacing.xs,
    fontStyle: "italic",
  },
  separator: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: Spacing.xl,
  },
  separatorLine: {
    flex: 1,
    height: 1,
  },
  separatorText: {
    marginHorizontal: Spacing.md,
    fontSize: 14,
  },
  qrSection: {
    alignItems: "center",
    justifyContent: "center",
  },
  qrCodeContainer: {
    padding: 12,
    borderRadius: BorderRadius.md,
  },
  qrPlaceholder: {
    justifyContent: "center",
    alignItems: "center",
    borderRadius: BorderRadius.md,
  },
});
