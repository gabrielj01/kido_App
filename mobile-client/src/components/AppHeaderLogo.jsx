import React from "react";
import { Image } from "react-native";

// Small wrapper to keep ratios consistent across platforms
export default function AppHeaderLogo() {
  return (
    <Image
      source={require("../../assets/brand/logo.png")}
      style={{ width: 120, height: 40, resizeMode: "contain" }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="App logo"
    />
  );
}
