import React, { useState } from "react";
import { View, StyleSheet, Pressable, Text, Platform, Modal } from "react-native";
import { Feather } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";

interface SelectionActionBarProps {
  selectedCount: number;
  totalCount: number;
  hasClipboard: boolean;
  clipboardCount: number;
  isSingleSelection: boolean;
  onSelectAll: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onRename: () => void;
  onShare: () => void;
  onDelete: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function SelectionActionBar({
  selectedCount,
  totalCount,
  hasClipboard,
  clipboardCount,
  isSingleSelection,
  onSelectAll,
  onCopy,
  onCut,
  onPaste,
  onRename,
  onShare,
  onDelete,
  onCancel,
  isLoading = false,
}: SelectionActionBarProps) {
  const insets = useSafeAreaInsets();
  const isAllSelected = selectedCount === totalCount;
  const isWeb = Platform.OS === "web";
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const IconButton = ({ 
    icon, 
    label, 
    onPress, 
    color = "#424242",
    disabled = false 
  }: { 
    icon: keyof typeof Feather.glyphMap; 
    label: string; 
    onPress: () => void;
    color?: string;
    disabled?: boolean;
  }) => (
    <Pressable 
      style={styles.iconButton} 
      onPress={onPress}
      disabled={disabled || isLoading}
    >
      <View style={[styles.iconCircle, disabled && styles.iconCircleDisabled]}>
        <Feather name={icon} size={24} color={disabled ? "#BDBDBD" : color} />
      </View>
      <Text style={[styles.iconLabel, disabled && styles.iconLabelDisabled]}>
        {label}
      </Text>
    </Pressable>
  );

  const containerStyle = [
    styles.container,
    { paddingBottom: insets.bottom + 8 }
  ];

  const content = (
    <>
      <View style={styles.header}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Feather name="x" size={28} color="#424242" />
        </Pressable>
        <Text style={styles.selectionText}>
          {selectedCount} fichier{selectedCount > 1 ? "(s)" : ""} selectionnés
        </Text>
        <Pressable onPress={onSelectAll} style={styles.selectAllButton}>
          <View style={[styles.circleButton, isAllSelected && styles.circleButtonActive]}>
            <Feather 
              name={isAllSelected ? "check" : ""} 
              size={20} 
              color={isAllSelected ? "#FFFFFF" : "#9E9E9E"}
            />
          </View>
        </Pressable>
      </View>
      
      <View style={styles.divider} />
      
      <View style={styles.actionsContainer}>
        <IconButton icon="send" label="Envoyer" onPress={onShare} />
        <IconButton icon="move" label="Déplacer" onPress={onCut} />
        <IconButton icon="trash-2" label="Supprimer" onPress={onDelete} color="#E53935" />
        <Pressable 
          style={styles.iconButton}
          onPress={() => setShowMoreMenu(true)}
        >
          <View style={styles.iconCircle}>
            <Feather name="more-vertical" size={24} color="#424242" />
          </View>
          <Text style={styles.iconLabel}>Plus</Text>
        </Pressable>
      </View>

      <Modal
        visible={showMoreMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoreMenu(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowMoreMenu(false)}
        >
          <View style={styles.moreMenu}>
            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                onShare();
                setShowMoreMenu(false);
              }}
            >
              <Feather name="share-2" size={20} color="#424242" />
              <Text style={styles.menuItemText}>Partager</Text>
            </Pressable>
            {isSingleSelection && (
              <Pressable 
                style={styles.menuItem}
                onPress={() => {
                  onRename();
                  setShowMoreMenu(false);
                }}
              >
                <Feather name="edit-2" size={20} color="#424242" />
                <Text style={styles.menuItemText}>Renommer</Text>
              </Pressable>
            )}
            <Pressable 
              style={styles.menuItem}
              onPress={() => {
                setShowMoreMenu(false);
              }}
            >
              <Feather name="info" size={20} color="#424242" />
              <Text style={styles.menuItemText}>Informations</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>

    </>
  );

  if (Platform.OS === "ios") {
    return (
      <BlurView intensity={80} tint="light" style={containerStyle}>
        {content}
      </BlurView>
    );
  }

  return (
    <View style={[containerStyle, styles.androidContainer]}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingTop: 12,
    paddingHorizontal: 16,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  androidContainer: {
    backgroundColor: "rgba(255, 255, 255, 0.98)",
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 12,
  },
  cancelButton: {
    padding: 8,
    marginRight: 12,
  },
  selectionText: {
    flex: 1,
    fontSize: 16,
    fontWeight: "600",
    color: "#212121",
  },
  selectAllButton: {
    padding: 8,
  },
  circleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: "#9E9E9E",
    alignItems: "center",
    justifyContent: "center",
  },
  circleButtonActive: {
    backgroundColor: "#2196F3",
    borderColor: "#2196F3",
  },
  divider: {
    height: 1,
    backgroundColor: "rgba(0, 0, 0, 0.08)",
    marginBottom: 12,
  },
  actionsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 8,
  },
  iconButton: {
    alignItems: "center",
    justifyContent: "center",
    minWidth: 60,
  },
  iconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0, 0, 0, 0.04)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  iconCircleDisabled: {
    opacity: 0.5,
  },
  iconLabel: {
    fontSize: 12,
    fontWeight: "500",
    color: "#424242",
    textAlign: "center",
  },
  iconLabelDisabled: {
    color: "#BDBDBD",
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  moreMenu: {
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 16,
    gap: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#F0F0F0",
  },
  menuItemText: {
    fontSize: 16,
    color: "#212121",
    fontWeight: "500",
  },
});
