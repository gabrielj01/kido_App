// mobile-client/src/screens/Search/BabysitterSearchScreen.jsx
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  FlatList,
  Pressable,
  ActivityIndicator,
  Image,
  Alert,
  StyleSheet,
} from "react-native";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { colors } from "../../theme/color";
import Screen from "../../components/Screen";

// Robust hook import
import * as AuthHook from "../../hooks/useAuth";
const useAuth = AuthHook.useAuth || AuthHook.default;

// UI atoms
import Chip from "../../components/Chip";
import RatingStars from "../../components/RatingStars";

// Services / API
import * as BabysitterService from "../../services/babysitterService";
import * as ApiClient from "../../api/client";
import config from "../../config";

/* ------------------------------ helpers ------------------------------ */

function distanceKm(aLat, aLng, bLat, bLng) {
  const A = Number(aLat), B = Number(aLng), C = Number(bLat), D = Number(bLng);
  if (![A, B, C, D].every(Number.isFinite)) return null;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(C - A);
  const dLon = toRad(D - B);
  const sa =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(A)) * Math.cos(toRad(C)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(sa), Math.sqrt(1 - sa));
  return Math.round(R * c * 10) / 10;
}
const s = (v, fb = "") => (v || v === 0 ? String(v) : fb);
function getAvatar(u) { return u?.photoUrl || u?.avatarUrl || null; }

function getBaseUrl(api, cfg) {
  return (
    cfg?.API_URL ||
    cfg?.API_BASE_URL ||
    api?.default?.defaults?.baseURL ||
    api?.api?.defaults?.baseURL ||
    api?.client?.defaults?.baseURL ||
    ""
  );
}

function useDebounced(value, delay = 350) {
  const [deb, setDeb] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDeb(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return deb;
}

/** Accept many payload shapes and return an array. */
function extractArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (payload && typeof payload === "object") {
    const k = Object.keys(payload).find((key) => Array.isArray(payload[key]));
    if (k) return payload[k];
  }
  return [];
}

/** Heuristic: does this user look like a sitter? (used for sorting boost only) */
function looksLikeSitter(u) {
  const role = (u?.role || u?.type || "").toString().toLowerCase();
  if (role.includes("babysitter") || role.includes("sitter")) return true;
  const hasRate = Number.isFinite(Number(u?.hourlyRate ?? u?.rate));
  const hasExp = Number.isFinite(Number(u?.experienceYears));
  const hasCert = Array.isArray(u?.certifications) && u.certifications.length > 0;
  const hasRating =
    Number.isFinite(Number(u?.ratingAvg)) ||
    Number.isFinite(Number(u?.rating)) ||
    Number.isFinite(Number(u?.ratingCount));
  return hasRate || hasExp || hasCert || hasRating;
}

/* ------------------------------ component ------------------------------ */

export default function BabysitterSearchScreen() {
  const navigation = useNavigation();
  const { user: me = {} } = (useAuth?.() ?? {});
  const api = ApiClient.default || ApiClient.api || ApiClient.client || null;

  // Query & dynamic filters (steppers)
  const [q, setQ] = useState("");
  const [minPrice, setMinPrice] = useState(0);     // ₪/h
  const [maxPrice, setMaxPrice] = useState(120);   // ₪/h
  const [minRating, setMinRating] = useState(0);   // 0..5
  const [lang, setLang] = useState("");
  const [nearMe, setNearMe] = useState(false);
  const [maxDist, setMaxDist] = useState(10);      // km
  const [sortBy, setSortBy] = useState("relevance");

  // Data status
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [raw, setRaw] = useState([]);

  const debQ = useDebounced(q, 350);
  const myLat = me?.latitude;
  const myLng = me?.longitude;

  // Remote fetch
  const fetchSitters = async (params) => {
    if (typeof BabysitterService.searchBabysitters === "function") {
      return await BabysitterService.searchBabysitters(params);
    }
    if (typeof BabysitterService.listBabysitters === "function") {
      return await BabysitterService.listBabysitters(params);
    }
    if (api?.get) {
      try {
        return await api.get("/api/babysitters", { params });
      } catch (e1) {
        try {
          // IMPORTANT: if we fallback, filter correctly by babysitter role
          return await api.get("/api/users", { params: { ...params, role: "babysitter" } });
        } catch (e2) {
          return await api.get("/api/babysitters/search", { params });
        }
      }
    }
    const base = getBaseUrl(ApiClient, config);
    const url = new URL("/api/babysitters", base);
    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, v);
    });
    const resp = await fetch(url.toString());
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    return await resp.json();
  };

  const load = async ({ refreshing = false } = {}) => {
    setError("");
    refreshing ? setRefreshing(true) : setLoading(true);
    try {
      const params = {
        q: debQ || undefined,
        language: lang || undefined,
        lat: Number.isFinite(myLat) ? myLat : undefined,
        lng: Number.isFinite(myLng) ? myLng : undefined,
        minRating: minRating || undefined,
        minPrice: minPrice || undefined,
        maxPrice: maxPrice || undefined,
      };
      const resp = await fetchSitters(params);
      const payload = resp?.data?.data || resp?.data || resp;
      const arr = extractArray(payload);
      setRaw(arr);
    } catch (e) {
      console.error(e);
      setError("Failed to load babysitters.");
    } finally {
      refreshing ? setRefreshing(false) : setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [debQ, lang]);

  // Local filtering + enrichment (distance). NO hard "role" filter (front sorts/boosts)
  const list = useMemo(() => {
    return (Array.isArray(raw) ? raw : [])
      .map((u) => {
        const lat = u?.latitude ?? u?.location?.lat ?? u?.address?.lat;
        const lng = u?.longitude ?? u?.location?.lng ?? u?.address?.lng;
        const dist = distanceKm(myLat, myLng, lat, lng);
        return { ...u, __distanceKm: dist, __isSitter: looksLikeSitter(u) };
      })
      .filter((u) => {
        const query = debQ.trim().toLowerCase();
        if (query) {
          const hay = `${s(u?.name)} ${s(u?.fullName)} ${s(u?.address?.city)} ${s(u?.city)}`
            .toLowerCase();
          if (!hay.includes(query)) return false;
        }
        const rating = Number(u?.ratingAvg ?? u?.rating ?? 0);
        if (Number.isFinite(minRating) && rating < minRating) return false;

        const price = Number(u?.hourlyRate ?? u?.rate ?? NaN);
        if (Number.isFinite(price)) {
          if (price < minPrice) return false;
          if (price > maxPrice) return false;
        }

        if (lang) {
          const langs = Array.isArray(u?.languages)
            ? u.languages.map((x) => String(x).toLowerCase())
            : [];
          if (!langs.some((L) => L.includes(lang.toLowerCase()))) return false;
        }

        if (nearMe && Number.isFinite(myLat) && Number.isFinite(myLng)) {
          if (Number.isFinite(u.__distanceKm) && u.__distanceKm > maxDist) return false;
          if (!Number.isFinite(u.__distanceKm) && Number.isFinite(u?.workRadiusKm)) {
            if (u.workRadiusKm < maxDist) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === "distance") {
          const da = Number.isFinite(a.__distanceKm) ? a.__distanceKm : 1e9;
          const db = Number.isFinite(b.__distanceKm) ? b.__distanceKm : 1e9;
          return da - db;
        }
        if (sortBy === "rating") {
          const ra = Number(a?.ratingAvg ?? a?.rating ?? 0);
          const rb = Number(b?.ratingAvg ?? b?.rating ?? 0);
          return rb - ra;
        }
        if (sortBy === "price") {
          const pa = Number(a?.hourlyRate ?? a?.rate ?? 1e9);
          const pb = Number(b?.hourlyRate ?? b?.rate ?? 1e9);
          return pa - pb;
        }
        // relevance: match position + sitter boost + rating tie-breaker
        const query = debQ.trim().toLowerCase();
        const hayA = `${s(a?.name)} ${s(a?.fullName)} ${s(a?.address?.city)} ${s(a?.city)}`
          .toLowerCase();
        const hayB = `${s(b?.name)} ${s(b?.fullName)} ${s(b?.address?.city)} ${s(b?.city)}`
          .toLowerCase();
        const idxA = query ? hayA.indexOf(query) : -1;
        const idxB = query ? hayB.indexOf(query) : -1;
        const qa = (idxA < 0 ? 0 : Math.max(10 - idxA, 1)) + (a.__isSitter ? 5 : 0);
        const qb = (idxB < 0 ? 0 : Math.max(10 - idxB, 1)) + (b.__isSitter ? 5 : 0);
        if (qb !== qa) return qb - qa;
        const ra = Number(a?.ratingAvg ?? a?.rating ?? 0);
        const rb = Number(b?.ratingAvg ?? b?.rating ?? 0);
        return rb - ra;
      });
  }, [raw, debQ, minPrice, maxPrice, minRating, lang, nearMe, maxDist, sortBy, myLat, myLng]);

  const onRefresh = () => load({ refreshing: true });

  /* ------------------------------ UI ------------------------------ */

  const renderItem = ({ item }) => {
    const name = s(item?.name || item?.fullName, "Babysitter");
    const avatar = getAvatar(item);
    const rating = Number(item?.ratingAvg ?? item?.rating ?? 0) || 0;
    const ratingCount = Number(item?.ratingCount ?? 0) || 0;
    const price = Number(item?.hourlyRate ?? item?.rate ?? NaN);
    const city = s(item?.address?.city || item?.city, "");
    const dist = item.__distanceKm;
    const sitterId = item?._id || item?.id;

    const goDetails = () =>
      navigation.navigate("BabysitterDetails", {
        sitterId,
        sitter: item,
      });

    return (
      <Pressable onPress={goDetails} style={[styles.card, styles.resultCard]} android_ripple={{ color: "#eee" }}>
        {/* Left color edge */}
        <View style={styles.colorEdge} />
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Image
            source={avatar ? { uri: avatar } : require("../../../assets/icon.png")}
            style={styles.avatar}
          />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={styles.title}>{name}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 }}>
              <RatingStars rating={rating} size={16} />
              <Text style={styles.muted}>
                {ratingCount > 0 ? `(${ratingCount})` : "(no reviews)"}
              </Text>
            </View>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
              {city ? <Chip label={city} /> : null}
              {Number.isFinite(dist) ? <Chip label={`${dist} km`} /> : null}
              {(item?.languages || []).slice(0, 3).map((L, idx) => (
                <View key={`${L}-${idx}`} style={styles.langPill}>
                  <Text style={{ color: colors.textDark }}>{String(L)}</Text>
                </View>
              ))}
            </View>
          </View>
          <View style={{ alignItems: "flex-end", gap: 6 }}>
            {Number.isFinite(price) ? (
              <View style={styles.pricePill}>
                <Ionicons name="cash-outline" size={14} color="#fff" />
                <Text style={styles.priceTxt}>{price} ₪/h</Text>
              </View>
            ) : null}
            <Ionicons name="chevron-forward" size={18} color={colors.textLight} />
          </View>
        </View>
      </Pressable>
    );
  };

  const sortCycle = ["relevance", "distance", "rating", "price"];
  const sortText = { relevance: "Relevance", distance: "Distance", rating: "Rating", price: "Price" };
  const toggleSort = () => {
    const i = sortCycle.indexOf(sortBy);
    setSortBy(sortCycle[(i + 1) % sortCycle.length]);
  };

  const clamp = (v, min, max) => Math.max(min, Math.min(max, v));
  const inc = (setter, val, step, min, max) => setter(clamp(val + step, min, max));
  const dec = (setter, val, step, min, max) => setter(clamp(val - step, min, max));

  useEffect(() => { if (minPrice > maxPrice) setMaxPrice(minPrice); }, [minPrice]);
  useEffect(() => { if (maxPrice < minPrice) setMinPrice(maxPrice); }, [maxPrice]);

  const resetFilters = () => {
    setQ("");
    setMinPrice(0);
    setMaxPrice(120);
    setMinRating(0);
    setLang("");
    setNearMe(false);
    setMaxDist(10);
    setSortBy("relevance");
    load();
  };

  return (
    <Screen edges={['top']}>
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {/* Colorful hero banner */}
        <LinearGradient
          colors={[colors.primary, "#FFB199"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroRow}>
            <View style={styles.heroIcon}>
              <Ionicons name="sparkles" size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroTitle}>Find a babysitter</Text>
              <Text style={styles.heroSub}>Nearby · Verified · Reviewed</Text>
            </View>
            <Pressable onPress={resetFilters} style={styles.heroReset}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.heroResetTxt}>Reset</Text>
            </Pressable>
          </View>
        </LinearGradient>

        {/* Filter card */}
        <View style={[styles.card, styles.filterCard]}>
          <Text style={styles.cardTitle}>Filters</Text>

          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Search by name or city"
            placeholderTextColor={colors.textLight}
            style={styles.input}
            autoCapitalize="none"
            returnKeyType="search"
            onSubmitEditing={() => load()}
          />

          {/* Budget steppers */}
          <View style={styles.gridRow}>
            <NumberField
              label="Min price (₪/h)"
              value={minPrice}
              onMinus={() => dec(setMinPrice, minPrice, 5, 0, 150)}
              onPlus={() => inc(setMinPrice, minPrice, 5, 0, 150)}
            />
            <NumberField
              label="Max price (₪/h)"
              value={maxPrice}
              onMinus={() => dec(setMaxPrice, maxPrice, 5, 0, 150)}
              onPlus={() => inc(setMaxPrice, maxPrice, 5, 0, 150)}
            />
          </View>

          {/* Rating + Language */}
          <View style={styles.gridRow}>
            <NumberField
              label="Min rating"
              value={minRating}
              format={(v) => v.toFixed(1)}
              onMinus={() => setMinRating(Math.max(0, Number((minRating - 0.5).toFixed(1))))}
              onPlus={() => setMinRating(Math.min(5, Number((minRating + 0.5).toFixed(1))))}
            />
            <View style={{ flex: 1 }}>
              <Text style={styles.smallLabel}>Language contains</Text>
              <TextInput
                value={lang}
                onChangeText={setLang}
                placeholder="e.g., English"
                placeholderTextColor={colors.textLight}
                style={styles.smallInput}
                autoCapitalize="none"
              />
            </View>
          </View>

          {/* Near me + distance stepper */}
          <View style={styles.gridRow}>
            <Pressable
              onPress={() => {
                if (!Number.isFinite(myLat) || !Number.isFinite(myLng)) {
                  Alert.alert("Location missing", "Add your coordinates in Profile to use 'Near me'.");
                  return;
                }
                setNearMe((v) => !v);
              }}
              style={nearMe ? styles.toggleOn : styles.toggleOff}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <Ionicons
                  name={nearMe ? "location" : "location-outline"}
                  size={16}
                  color={nearMe ? "white" : colors.textDark}
                />
                <Text style={nearMe ? styles.toggleOnTxt : styles.toggleOffTxt}>
                  {nearMe ? "Near me: ON" : "Near me: OFF"}
                </Text>
              </View>
            </Pressable>

            <NumberField
              label="Max distance (km)"
              value={maxDist}
              onMinus={() => dec(setMaxDist, maxDist, 1, 1, 50)}
              onPlus={() => inc(setMaxDist, maxDist, 1, 1, 50)}
            />
          </View>

          <View style={styles.filterActions}>
            <Pressable onPress={toggleSort} style={styles.sortBtn}>
              <Ionicons name="swap-vertical" size={16} color={colors.textDark} />
              <Text style={styles.sortBtnTxt}>Sort: {sortText[sortBy]}</Text>
            </Pressable>

            <Pressable onPress={resetFilters} style={styles.resetBtn}>
              <Ionicons name="refresh" size={16} color={colors.primary} />
              <Text style={styles.resetBtnTxt}>Reset filters</Text>
            </Pressable>
          </View>
        </View>

        {/* Results */}
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.muted}>Loading babysitters…</Text>
          </View>
        ) : error ? (
          <View style={styles.center}>
            <Text style={styles.error}>{error}</Text>
            <Pressable style={styles.secondaryBtn} onPress={() => load()}>
              <Text style={styles.secondaryBtnTxt}>Retry</Text>
            </Pressable>
          </View>
        ) : list.length === 0 ? (
          <View style={styles.center}>
            <Text style={styles.muted}>No babysitters match your filters.</Text>
            <Pressable style={[styles.secondaryBtn, { marginTop: 10 }]} onPress={resetFilters}>
              <Text style={styles.secondaryBtnTxt}>Clear filters</Text>
            </Pressable>
            <Text style={[styles.muted, { marginTop: 8 }]}>
              Source returned {Array.isArray(raw) ? raw.length : 0} items.
            </Text>
          </View>
        ) : (
          <FlatList
            data={list}
            keyExtractor={(item, idx) => String(item?._id || item?.id || idx)}
            renderItem={renderItem}
            contentContainerStyle={{ padding: 16, paddingTop: 8 }}
            refreshing={refreshing}
            onRefresh={onRefresh}
          />
        )}
      </View>
    </Screen>
  );
}

/* -------------------------- small number field -------------------------- */

function NumberField({ label, value, onMinus, onPlus, format }) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={styles.smallLabel}>{label}</Text>
      <View style={styles.stepper}>
        <Pressable onPress={onMinus} style={styles.stepBtn}>
          <Text style={styles.stepTxt}>−</Text>
        </Pressable>
        <Text style={styles.stepValue}>{format ? format(value) : value}</Text>
        <Pressable onPress={onPlus} style={styles.stepBtn}>
          <Text style={styles.stepTxt}>＋</Text>
        </Pressable>
      </View>
    </View>
  );
}

/* ------------------------------ styles ------------------------------ */

const styles = StyleSheet.create({
  /* Hero */
  hero: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 10,
    borderRadius: 16,
    padding: 14,
  },
  heroRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  heroIcon: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center", justifyContent: "center",
  },
  heroTitle: { color: "white", fontWeight: "800", fontSize: 18 },
  heroSub: { color: "white", opacity: 0.85, marginTop: 2 },
  heroReset: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "white", paddingHorizontal: 10, paddingVertical: 8,
    borderRadius: 12,
  },
  heroResetTxt: { color: colors.primary, fontWeight: "800" },

  /* Cards */
  card: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    padding: 14,
    marginBottom: 14,
  },
  filterCard: {
    marginHorizontal: 16,
    // subtle tint around filters
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  resultCard: {
    position: "relative",
    overflow: "hidden",
  },
  colorEdge: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    width: 6,
    backgroundColor: colors.primary,
  },

  cardTitle: { fontWeight: "800", color: colors.textDark, marginBottom: 10 },

  input: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFF8F6",
    color: colors.textDark,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallInput: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFF8F6",
    color: colors.textDark,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  smallLabel: { color: colors.textLight, marginBottom: 6 },

  gridRow: { flexDirection: "row", gap: 12, marginTop: 12 },

  /* Stepper */
  stepper: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 8,
    height: 40,
  },
  stepBtn: {
    width: 36,
    height: 28,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: "#FFF1ED",
    alignItems: "center",
    justifyContent: "center",
  },
  stepTxt: { color: colors.textDark, fontWeight: "800", fontSize: 16 },
  stepValue: { color: colors.textDark, fontWeight: "800", minWidth: 36, textAlign: "center" },

  toggleOn: {
    flex: 1,
    backgroundColor: colors.primary,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  toggleOff: {
    flex: 1,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 10,
  },
  toggleOnTxt: { color: "white", fontWeight: "800" },
  toggleOffTxt: { color: colors.textDark, fontWeight: "700" },

  filterActions: {
    marginTop: 12,
    flexDirection: "row",
    gap: 10,
    justifyContent: "space-between",
  },
  sortBtn: {
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  sortBtnTxt: { color: colors.textDark, fontWeight: "800" },

  resetBtn: {
    backgroundColor: "#FFF1ED",
    borderWidth: 1,
    borderColor: colors.border,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  resetBtnTxt: { color: colors.primary, fontWeight: "800" },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#eee",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: { color: colors.textDark, fontWeight: "800", fontSize: 16 },
  muted: { color: colors.textLight, marginTop: 6 },

  pricePill: {
    backgroundColor: colors.primary,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  priceTxt: { color: "#fff", fontWeight: "800", fontSize: 12 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  error: { color: "#c00", marginBottom: 8, textAlign: "center" },
  langPill: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
});
