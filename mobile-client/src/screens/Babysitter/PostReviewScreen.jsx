// All comments in English as requested.
import React, { useState } from "react";
import { View, Text, TextInput, Pressable, Alert } from "react-native";
import { useRoute, useNavigation } from "@react-navigation/native";
import { colors } from "../../theme/color";
import RatingStars from "../../components/RatingStars"; // display-only; we'll add simple star input below
import { addSitterReview } from "../../services/reviewsService";
import * as AuthHook from "../../hooks/useAuth";
import  Ionicons  from "@expo/vector-icons/Ionicons";
const useAuth = AuthHook.useAuth || AuthHook.default;


export default function PostReviewScreen() {
  const { user } = (useAuth?.() ?? { user: null });
  const route = useRoute();
  const navigation = useNavigation();
  const { sitterId, sitterName, bookingId } = route.params || {};

  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(false);

  // Simple interactive stars
  const StarsInput = () => (
  <View style={{ flexDirection: "row", marginTop: 8 }}>
    {[1, 2, 3, 4, 5].map((n) => (
      <Pressable key={n} onPress={() => setRating(n)} style={{ marginRight: 6 }}>
        <Ionicons
          name={n <= rating ? "star" : "star-outline"}
          size={28}
          color={colors.primary}
        />
      </Pressable>
    ))}
  </View>
);


  const onSubmit = async () => {
    if (!sitterId) return Alert.alert("Missing sitter", "Sitter id is required.");
    setLoading(true);
    try {
      await addSitterReview(sitterId, {
        rating,
        comment: comment.trim(),
        bookingId,
        authorName: user?.name || "Parent",
      });
      Alert.alert("Thanks!", "Your review has been posted.");
      navigation.replace("BabysitterReviews", { sitterId, sitterName });
    } catch (e) {
      Alert.alert("Error", e?.response?.data?.error || e.message || "Failed to post review.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={{ flex:1, backgroundColor:colors.bg, padding:16 }}>
      <Text style={{ fontSize:22, fontWeight:"800", color:colors.textDark }}>
        Review {sitterName || "the sitter"}
      </Text>

      <Text style={{ marginTop:12, color:colors.textDark, fontWeight:"700" }}>Rating</Text>
      <StarsInput />

      <Text style={{ marginTop:16, color:colors.textDark, fontWeight:"700" }}>Comment (optional)</Text>
      <TextInput
        value={comment}
        onChangeText={setComment}
        placeholder="Tell other parents how it went..."
        placeholderTextColor={colors.textLight}
        multiline
        style={{ marginTop:8, minHeight:120, borderWidth:1, borderColor:colors.border, borderRadius:12, padding:12, color:colors.textDark, backgroundColor:"#fff" }}
      />

      <Pressable
        onPress={onSubmit}
        disabled={loading || rating < 1}
        style={{
          marginTop:20,
          backgroundColor: loading ? colors.border : colors.primary,
          paddingVertical:14, borderRadius:14, alignItems:"center"
        }}
      >
        <Text style={{ color:"#fff", fontWeight:"800" }}>{loading ? "Submitting..." : "Submit review"}</Text>
      </Pressable>
    </View>
  );
}
