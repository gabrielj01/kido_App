import React, { useEffect, useState, useCallback, useMemo } from "react";
import { View, Text, ActivityIndicator, FlatList, Pressable } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { colors } from "../../theme/color";
import RatingStars from "../../components/RatingStars";
import { fetchBabysitterReviews, computeReviewStats } from "../../services/reviewsService";
import { useAuth } from "../../hooks/useAuth";
import Screen from "../../components/Screen";

// Screen shows reviews about a babysitter.
// It prefers sitterId from route params, and falls back to the logged-in user.
export default function BabysitterReviewsScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { user } = useAuth();

  const sitterIdFromParams =
     route?.params?.babysitterId ??
     route?.params?.sitterId ??
     route?.params?.userId ??
     route?.params?.forUserId ??
     route?.params?.sitter?._id ??
     route?.params?.babysitter?._id ??
     null;
 
   const sitterNameFromParams =
     route?.params?.sitterName ??
     route?.params?.babysitterName ??
     route?.params?.name ??
     route?.params?.sitter?.name ??
     route?.params?.babysitter?.name ??
     "";
 
   const sitterId = sitterIdFromParams ? String(sitterIdFromParams) : (user?._id || user?.id || null);
   const sitterName = sitterNameFromParams || user?.name || "";

  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState([]);
  const [hasMore, setHasMore] = useState(true);

  const loadPage = useCallback(
    async (p = 1) => {
      if (!sitterId) return;
      setLoading(true);
      try {
        const { items: chunk } = await fetchBabysitterReviews(sitterId, { page: p, limit: 20 });
        setItems((prev) => (p === 1 ? chunk : [...prev, ...chunk]));
        setHasMore(Array.isArray(chunk) && chunk.length === 20);
      } catch (e) {
        // optional: show a toast here
      } finally {
        setLoading(false);
      }
    },
    [sitterId]
  );

  useEffect(() => {
    loadPage(1);
  }, [loadPage]);

  const stats = useMemo(() => computeReviewStats(items), [items]);

  const renderItem = ({ item }) => (
    <View
      style={{
        backgroundColor: colors.card,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: 14,
        padding: 12,
        marginBottom: 10,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 6 }}>
        <Text style={{ fontWeight: "700", color: colors.textDark }}>
          {item.authorName || "Parent"}
        </Text>
        <Text style={{ color: colors.textLight }}>
          {new Date(item.createdAt || item.date || Date.now()).toLocaleDateString()}
        </Text>
      </View>
        <RatingStars
          rating={Number(item.rating) || 0}
          count={Number(item.rating) || undefined}
        />
      {!!item.comment && (
        <Text style={{ marginTop: 8, color: colors.textDark, lineHeight: 20 }}>
          {item.comment}
        </Text>
      )}
    </View>
  );

  return (
    <Screen edges={[""]}>
    <View style={{ flex: 1, backgroundColor: colors.bg, padding: 16 }}>
      {/* Header */}
      <View style={{ marginBottom: 14 }}>
        <Text style={{ fontSize: 22, fontWeight: "800", color: colors.textDark }}>
          {sitterName ? `${sitterName} — Reviews` : "Reviews"}
        </Text>
        <View style={{ marginTop: 6, flexDirection: "row", alignItems: "center" }}>
          <RatingStars rating={stats.avg} count={stats.count} />
          <Text style={{ marginLeft: 8, color: colors.textLight }}>
            {stats.avg} / 5 · {stats.count} review{stats.count === 1 ? "" : "s"}
          </Text>
        </View>
      </View>

      {loading && page === 1 ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator />
          <Text style={{ marginTop: 6, color: colors.textLight }}>Loading reviews…</Text>
        </View>
      ) : items.length === 0 ? (
        <View style={{ alignItems: "center", marginTop: 24 }}>
          <Text style={{ color: colors.textLight }}>No reviews yet.</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(it, idx) => String(it._id || it.id || idx)}
          renderItem={renderItem}
          contentContainerStyle={{ paddingBottom: 16 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (hasMore && !loading) {
              const next = page + 1;
              setPage(next);
              loadPage(next);
            }
          }}
          ListFooterComponent={
            loading && page > 1 ? (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator />
              </View>
            ) : null
          }
        />
      )}

      {/* Back button */}
      <Pressable
        onPress={() => navigation.goBack()}
        style={{
          position: "absolute",
          right: 30,
          bottom:30,
          paddingHorizontal: 16,
          paddingVertical: 12,
          backgroundColor: colors.primary,
          borderRadius: 14,
        }}
      >
        <Text style={{ color: "#fff", fontWeight: "800" }}>Back</Text>
      </Pressable>
    </View>
    </Screen>
  );
}
