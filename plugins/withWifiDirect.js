const { withAndroidManifest } = require("@expo/config-plugins");

const withWifiDirect = (config) => {
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
      { name: "android.hardware.wifi.direct", required: "false" },
      { name: "android.hardware.wifi", required: "false" },
      { name: "android.hardware.location.gps", required: "false" },
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

module.exports = withWifiDirect;
