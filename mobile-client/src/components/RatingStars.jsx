import React from "react";
import { View, Text } from "react-native";
import { MaterialIcons } from "@expo/vector-icons";

/**

 * @param {number} rating - Average rating 0..5 (can be decimal).
 * @param {number} size - Icon size.
 * @param {number} count - Optional count of reviews to display.
 */
export default function RatingStars({ rating = 0, size = 18, count }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  const empty = 5 - full - (half ? 1 : 0);

  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
      {Array.from({ length: full }).map((_, i) => (
        <MaterialIcons key={`f-${i}`} name="star" size={size} color="#F5A524" />
      ))}
      {half && <MaterialIcons name="star-half" size={size} color="#F5A524" />}
      {Array.from({ length: empty }).map((_, i) => (
        <MaterialIcons key={`e-${i}`} name="star-border" size={size} color="#F5A524" />
      ))}
      {typeof count === "number" && (
        <Text style={{ marginLeft: 6, color: "#6B7C93" }}>({count})</Text>
      )}
    </View>
  );
}
