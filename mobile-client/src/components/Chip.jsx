import React from "react";
import { Text, View } from "react-native";
import { colors } from "../theme/color";

/** Small rounded badge for tags/certifications */
export default function Chip({ label }) {
  return (
    <View
      style={{
        backgroundColor: colors.bg,
        borderColor: colors.border,
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        marginRight: 8,
        marginBottom: 8,
      }}
    >
      <Text style={{ color: colors.textLight }}>{label}</Text>
    </View>
  );
}
