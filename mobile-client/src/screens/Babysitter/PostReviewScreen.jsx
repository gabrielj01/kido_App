import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/color";
import RatingStars from "../../components/RatingStars";
import { addSitterReview } from "../../services/reviewsService";
import * as AuthHook from "../../hooks/useAuth";
import Ionicons from "@expo/vector-icons/Ionicons";

const useAuth = AuthHook.useAuth || AuthHook.default;

export default function PostReviewScreen() {
  const { user } = (useAuth?.() ?? { user: null });
  const route = useRoute();
  const navigation = useNavigation();
  const { sitterId, sitterName, bookingId } = route.params || {};

  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Lightweight star input without extra deps: tap on stars to set rating 1..5
  const StarInput = () => (
    <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
      {[1, 2, 3, 4, 5].map((v) => (
        <Pressable key={v} onPress={() => setRating(v)}>
          <Ionicons
            name={rating >= v ? "star" : "star-outline"}
            size={28}
            color={rating >= v ? "#F5A524" : "#A0AEC0"}
          />
        </Pressable>
      ))}
    </View>
  );

  const onSubmit = async () => {
    if (!sitterId || !bookingId) {
      return Alert.alert("Unavailable", "Missing sitterId or bookingId.");
    }
    if (rating < 1) {
      return Alert.alert("Rating required", "Please choose at least 1 star.");
    }
    try {
      setLoading(true);
      await addSitterReview(sitterId, {
        rating,
        comment: (comment || "").trim(),
        bookingId,
        authorName: user?.name || "Parent",
      });
      Alert.alert("Thanks!", "Your review has been posted.");
      // Go to sitter's reviews list (if present) or simply go back
      navigation.replace("BabysitterReviews", { sitterId, sitterName });
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message || "Failed to post review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      <Text style={{ fontSize: 20, fontWeight: "800", color: colors.textDark }}>Leave a review</Text>
      <Text style={{ marginTop: 6, color: colors.textLight }}>
        for <Text style={{ color: colors.textDark, fontWeight: "800" }}>{sitterName || "the babysitter"}</Text>
      </Text>

      <View style={{ marginTop: 16, backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1, borderRadius: 14, padding: 14 }}>
        <Text style={{ color: colors.textDark, fontWeight: "700" }}>Your rating</Text>
        <StarInput />
        <View style={{ height: 12 }} />
        <Text style={{ color: colors.textDark, fontWeight: "700" }}>Comment (optional)</Text>
        <TextInput
          placeholder="Tell other parents about your experience…"
          placeholderTextColor="#A0AEC0"
          value={comment}
          onChangeText={setComment}
          multiline
          style={{
            marginTop: 8,
            minHeight: 100,
            borderColor: colors.border,
            borderWidth: 1,
            borderRadius: 10,
            padding: 10,
            color: colors.textDark,
            textAlignVertical: "top",
            backgroundColor: "#fff",
          }}
        />
        <Pressable
          onPress={onSubmit}
          disabled={loading || rating < 1}
          style={{
            marginTop: 16,
            backgroundColor: loading || rating < 1 ? colors.border : colors.primary,
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: "center",
          }}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>
            {loading ? "Submitting..." : "Submit review"}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
