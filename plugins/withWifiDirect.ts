import { ConfigPlugin, withAndroidManifest, withInfoPlist } from "@expo/config-plugins";

const withWifiDirect: ConfigPlugin = (config) => {
  config = withAndroidManifest(config, async (config) => {
    const mainApplication = config.modResults.manifest.application?.[0];
    
    if (!mainApplication) {
      return config;
    }

    const permissions = config.modResults.manifest["uses-permission"] || [];
    
    const requiredPermissions = [
      "android.permission.ACCESS_WIFI_STATE",
      "android.permission.CHANGE_WIFI_STATE",
      "android.permission.ACCESS_FINE_LOCATION",
      "android.permission.ACCESS_COARSE_LOCATION",
      "android.permission.NEARBY_WIFI_DEVICES",
      "android.permission.CHANGE_NETWORK_STATE",
      "android.permission.ACCESS_NETWORK_STATE",
    ];

    requiredPermissions.forEach((permission) => {
      if (!permissions.some((p) => p.$?.["android:name"] === permission)) {
        permissions.push({
          $: { "android:name": permission },
        });
      }
    });

    config.modResults.manifest["uses-permission"] = permissions;

    const usesFeature = config.modResults.manifest["uses-feature"] || [];
    
    const requiredFeatures = [
      { name: "android.hardware.wifi.direct", required: "false" as const },
      { name: "android.hardware.wifi", required: "false" as const },
      { name: "android.hardware.location.gps", required: "false" as const },
    ];

    requiredFeatures.forEach((feature) => {
      if (!usesFeature.some((f) => f.$?.["android:name"] === feature.name)) {
        usesFeature.push({
          $: {
            "android:name": feature.name,
            "android:required": feature.required,
          },
        });
      }
    });

    config.modResults.manifest["uses-feature"] = usesFeature;

    return config;
  });

  return config;
};

export default withWifiDirect;
