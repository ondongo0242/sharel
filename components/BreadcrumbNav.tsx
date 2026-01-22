import React, { useRef, useEffect, useMemo } from "react";
import { View, StyleSheet, Pressable, Text, ScrollView, Platform } from "react-native";
import { Feather } from "@expo/vector-icons";

interface PathSegment {
  name: string;
  path: string;
  isRoot: boolean;
}

interface BreadcrumbNavProps {
  currentPath: string;
  onNavigate: (path: string, historyIndex: number) => void;
  pathHistory: string[];
}

const ROOT_PATH = "file:///storage/emulated/0";
const ROOT_PATH_ALT = "/storage/emulated/0";

export function parsePathSegments(path: string): PathSegment[] {
  const cleanPath = path.replace("file://", "");
  const segments: PathSegment[] = [];
  
  segments.push({
    name: "Stockage",
    path: ROOT_PATH,
    isRoot: true,
  });
  
  if (cleanPath === ROOT_PATH_ALT || cleanPath === ROOT_PATH_ALT + "/") {
    return segments;
  }
  
  const relativePath = cleanPath.replace(ROOT_PATH_ALT, "").replace(/^\//, "");
  const parts = relativePath.split("/").filter(Boolean);
  
  let currentBuiltPath = ROOT_PATH_ALT;
  
  for (const part of parts) {
    currentBuiltPath = `${currentBuiltPath}/${part}`;
    segments.push({
      name: part,
      path: `file://${currentBuiltPath}`,
      isRoot: false,
    });
  }
  
  return segments;
}

export default function BreadcrumbNav({ currentPath, onNavigate, pathHistory }: BreadcrumbNavProps) {
  const scrollViewRef = useRef<ScrollView>(null);
  const segments = useMemo(() => parsePathSegments(currentPath), [currentPath]);
  
  useEffect(() => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd({ animated: true });
    }, 100);
  }, [segments]);

  const handleSegmentPress = (segment: PathSegment, index: number) => {
    if (segment.path === currentPath) {
      return;
    }
    
    const historyIndex = pathHistory.findIndex(p => p === segment.path);
    onNavigate(segment.path, historyIndex !== -1 ? historyIndex : -1);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {segments.map((segment, index) => {
          const isLast = index === segments.length - 1;
          const isActive = segment.path === currentPath;
          
          return (
            <View key={segment.path} style={styles.segmentWrapper}>
              <Pressable
                style={[
                  styles.segment,
                  isActive && styles.segmentActive,
                ]}
                onPress={() => handleSegmentPress(segment, index)}
                disabled={isActive}
              >
                {segment.isRoot ? (
                  <Feather name="hard-drive" size={14} color={isActive ? "#2196F3" : "#757575"} style={styles.rootIcon} />
                ) : null}
                <Text
                  style={[
                    styles.segmentText,
                    isActive && styles.segmentTextActive,
                  ]}
                  numberOfLines={1}
                >
                  {segment.name}
                </Text>
              </Pressable>
              {!isLast ? (
                <Feather name="chevron-right" size={14} color="#BDBDBD" style={styles.separator} />
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#FAFAFA",
    borderBottomWidth: 1,
    borderBottomColor: "#E0E0E0",
  },
  scrollContent: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: "100%",
  },
  segmentWrapper: {
    flexDirection: "row",
    alignItems: "center",
  },
  segment: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 6,
    backgroundColor: "transparent",
  },
  segmentActive: {
    backgroundColor: "#E3F2FD",
  },
  rootIcon: {
    marginRight: 4,
  },
  segmentText: {
    fontSize: 13,
    color: "#757575",
    maxWidth: 150,
  },
  segmentTextActive: {
    color: "#2196F3",
    fontWeight: "500",
  },
  separator: {
    marginHorizontal: 2,
  },
});
