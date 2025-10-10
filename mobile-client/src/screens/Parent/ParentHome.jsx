import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import RatingStars from '../../components/RatingStars';
import { useFocusEffect } from '@react-navigation/native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ReviewPromptModal from '../../components/ReviewPromptModal';
import { fetchEndedUnreviewedBookings } from '../../services/reviewsService';
import { getUpcomingBookings } from '../../api/bookingApi';
import Screen from '../../components/Screen';

export default function ParentHome({ navigation }) {
  const { user, logout } = useAuth?.() || { user: null, logout: () => {} };
  const firstName = user?.firstName || user?.name || 'Parent';

  // UI state
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Stats & upcoming list
  const [stats, setStats] = useState({ openRequests: 0, upcoming: 0, favorites: 0 });
  const [upcoming, setUpcoming] = useState([]);

  // ===== Review prompt logic (only on ParentHome) =====
  const [prompt, setPrompt] = useState(null); // { bookingId, sitterId, sitterName }

  const runCheck = useCallback(async () => {
    try {
      const candidates = await fetchEndedUnreviewedBookings(); // ended, not canceled, no review
      for (const c of candidates) {
        const key = `reviewPrompted_${c.bookingId}`;
        const already = await AsyncStorage.getItem(key);
        if (!already) {
          setPrompt(c);
          break;
        }
      }
    } catch {
      // silent
    }
  }, []);

  const dismissPrompt = useCallback(async () => {
    if (prompt?.bookingId) {
      await AsyncStorage.setItem(`reviewPrompted_${prompt.bookingId}`, '1');
    }
    setPrompt(null);
  }, [prompt]);

  const goWriteNow = useCallback(async () => {
    if (prompt?.bookingId) {
      await AsyncStorage.setItem(`reviewPrompted_${prompt.bookingId}`, '1');
    }
    const p = prompt;
    setPrompt(null);
    navigation?.navigate?.('PostReview', {
      sitterId: p?.sitterId,
      sitterName: p?.sitterName,
      bookingId: p?.bookingId,
    });
  }, [prompt, navigation]);
  // ===== end review prompt logic =====

  // Load upcoming bookings (parent side)
  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      // parent usually wants only accepted bookings
      const list = await getUpcomingBookings({ limit: 5, status: 'accepted' });
      const safe = Array.isArray(list) ? list : [];
      setUpcoming(safe);
      setStats((s) => ({ ...s, upcoming: safe.length }));
    } catch (e) {
      console.log('Load upcoming (parent) failed:', e?.response?.data || e.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch on focus: load upcoming + check review prompt
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      (async () => {
        if (!alive) return;
        await Promise.all([load(), runCheck()]);
      })();
      return () => {
        alive = false;
      };
    }, [load, runCheck])
  );

  // Pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true).finally(() => {});
  }, [load]);

  const tryNavigate = (routeName, params) => {
    try {
      if (navigation?.navigate) navigation.navigate(routeName, params);
      else Alert.alert('Navigation', `Wire this to "${routeName}" screen.`);
    } catch {
      Alert.alert('Navigation', `Screen "${routeName}" not found yet.`);
    }
  };

  return (
    <Screen edges={['']}>
    <ScrollView
      contentContainerStyle={styles.scroll}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <Image
            source={{ uri: user?.photoUrl || 'https://i.pravatar.cc/120?img=11' }}
            style={styles.avatar}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi, {firstName} 👋</Text>
            <Text style={styles.subHello}>Plan your next night out with peace of mind.</Text>
            <View style={styles.quickRow}>
              <Pill label="Open requests" value={String(stats.openRequests)} />
              <Pill label="Upcoming" value={String(stats.upcoming)} />
              <Pill label="Favorites" value={String(stats.favorites)} />
            </View>
          </View>
        </View>
      </View>

      {/* Info banner */}
      <View style={styles.infoBanner}>
        <View style={styles.infoIcon}>
          <Ionicons name="information-circle" size={18} color={COLORS.primaryDark} />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.infoTitle}>Complete your family profile</Text>
          <Text style={styles.infoSubtitle}>
            Add kids’ ages & special needs to get better sitter matches.
          </Text>
        </View>
        <Pressable style={styles.infoCta} onPress={() => tryNavigate('Profile')}>
          <Text style={styles.infoCtaText}>Edit</Text>
        </Pressable>
      </View>

      {/* Search CTA */}
      <View style={styles.card}>
        <View style={styles.searchRow}>
          <View style={styles.searchIconWrap}>
            <Ionicons name="search" size={18} color={COLORS.text} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.searchTitle}>Find a babysitter</Text>
            <Text style={styles.searchSub}>Nearby · Verified · Reviewed</Text>
          </View>
          <Pressable style={styles.primaryBtn} onPress={() => tryNavigate('Search')}>
            <Text style={styles.primaryBtnText}>Search</Text>
          </Pressable>
        </View>

        {/* Quick presets */}
        <View style={styles.chipsRow}>
          <Chip label="Tonight 19:00–23:00" onPress={() => tryNavigate('Search', { preset: 'tonight' })} />
          <Chip label="Tomorrow afternoon" onPress={() => tryNavigate('Search', { preset: 'tomorrow_pm' })} />
          <Chip label="Weekend" onPress={() => tryNavigate('Search', { preset: 'weekend' })} />
        </View>
      </View>

      {/* Quick actions grid */}
      <SectionHeader title="Quick actions" />
      <View style={styles.actionsGrid}>
        <QuickAction
          icon={<Ionicons name="search" size={22} color={COLORS.text} />}
          label="Search"
          onPress={() => tryNavigate('Search')}
        />

        <QuickAction
          icon={<MaterialIcons name="event-available" size={22} color={COLORS.text} />}
          label="Bookings"
          onPress={() => tryNavigate('Bookings')}
        />

        <QuickAction
          icon={<Ionicons name="person-circle" size={22} color={COLORS.text} />}
          label="Profile"
          onPress={() => tryNavigate('Profile')}
        />
      </View>

      {/* Upcoming bookings */}
      <SectionHeader title="Upcoming bookings" />
      {loading ? (
        <View style={styles.card}>
          <Text style={{ color: COLORS.textMuted }}>Loading…</Text>
        </View>
      ) : upcoming.length === 0 ? (
        <EmptyCard
          title="No upcoming bookings"
          subtitle="When you confirm a booking, it will appear here."
          actionLabel="View requests"
          onAction={() => tryNavigate('Requests')}
        />
      ) : (
        <View style={styles.card}>
          {upcoming.map((b, idx) => {
            const start = new Date(b.startISO);
            const end = new Date(b.endISO);
            const dateStr = start.toLocaleDateString();
            const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const sitterName = b?.sitterId?.name || '—';
            const sitterRating = b?.sitterId?.ratingAvg ?? null;

            return (
              <View
                key={b._id || String(idx)}
                style={[styles.bookingRow, idx < upcoming.length - 1 && styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingPrimary}>
                    {dateStr} · {timeStr}
                  </Text>
                  <Text style={styles.bookingSecondary}>With {sitterName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  {typeof sitterRating === 'number' ? (
                    <RatingStars rating={Number(sitterRating)} size={14} />
                  ) : null}
                  <Pressable
                    style={styles.bookingAction}
                    onPress={() => tryNavigate('BookingDetails', { bookingId: b._id || b.id })}
                  >
                    <Text style={styles.bookingActionText}>Details</Text>
                  </Pressable>

                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Logout */}
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color={COLORS.danger} />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      <View style={{ height: 90 }} />

      {/* Floating primary action */}
      <Pressable
        style={styles.fab}
        onPress={() => tryNavigate('Search')}
        android_ripple={{ color: '#ffffff55' }}
      >
        <Ionicons name="search" size={18} color="#fff" />
        <Text style={styles.fabText}>Find a babysitter</Text>
      </Pressable>

      {/* Review prompt modal */}
      <ReviewPromptModal
        visible={!!prompt}
        sitterName={prompt?.sitterName}
        onLater={dismissPrompt}
        onConfirm={goWriteNow}
      />
    </ScrollView>
    </Screen>
  );
}

/** Small UI helpers */
function SectionHeader({ title }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function Pill({ label, value }) {
  return (
    <View style={styles.pill}>
      <Text style={styles.pillLabel}>{label}</Text>
      <Text style={styles.pillValue}>{value}</Text>
    </View>
  );
}

function Chip({ label, onPress }) {
  return (
    <Pressable style={styles.chip} onPress={onPress}>
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function QuickAction({ icon, label, onPress }) {
  return (
    <Pressable style={styles.quickAction} onPress={onPress}>
      <View style={styles.quickIcon}>{icon}</View>
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function EmptyCard({ title, subtitle, actionLabel, onAction }) {
  return (
    <View style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      <Pressable style={styles.secondaryBtn} onPress={onAction}>
        <Text style={styles.secondaryBtnText}>{actionLabel}</Text>
      </Pressable>
    </View>
  );
}

/** Theme (aligned with SitterHome) */
const COLORS = {
  bg: '#F6FAFF',
  card: '#FFFFFF',
  text: '#2E3A59',
  textMuted: '#6B7A99',
  border: '#E6ECF5',
  primary: '#FF7A59',
  primaryDark: '#FF5C36',
  success: '#0EAD69',
  danger: '#C53F3F',
};

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    backgroundColor: COLORS.bg,
    position: 'relative',
  },

  /* Header */
  headerCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    padding: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
    marginBottom: 14,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 62, height: 62, borderRadius: 31, backgroundColor: '#E7F1FF' },
  hello: { fontSize: 20, fontWeight: '700', color: COLORS.text, marginBottom: 4 },
  subHello: { fontSize: 12, color: COLORS.textMuted },
  quickRow: { flexDirection: 'row', gap: 10, marginTop: 12 },

  pill: {
    flex: 1,
    backgroundColor: '#F1F7FF',
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 2,
  },
  pillLabel: { fontSize: 12, color: COLORS.textMuted },
  pillValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  /* Info banner */
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFF3EE',
    borderColor: COLORS.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 12,
    marginBottom: 14,
  },
  infoIcon: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE1D7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoTitle: { fontSize: 14, fontWeight: '700', color: COLORS.text },
  infoSubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 2 },
  infoCta: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  infoCtaText: { color: '#fff', fontWeight: '700', fontSize: 12 },

  /* Search CTA card */
  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  searchIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFF8F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchTitle: { color: COLORS.text, fontSize: 16, fontWeight: '700' },
  searchSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    backgroundColor: '#FFF8F6',
    borderColor: COLORS.border,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
  },
  chipText: { color: COLORS.text, fontWeight: '600', fontSize: 12 },

  /* Section */
  sectionHeader: { marginTop: 10, marginBottom: 8, paddingHorizontal: 2 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  /* Upcoming bookings */
  bookingRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, gap: 10 },
  rowDivider: { borderBottomWidth: 1, borderBottomColor: COLORS.border },
  bookingPrimary: { color: COLORS.text, fontSize: 14, fontWeight: '600', marginBottom: 2 },
  bookingSecondary: { color: COLORS.textMuted, fontSize: 12 },
  bookingAction: {
    backgroundColor: '#FFF1ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 6,
  },
  bookingActionText: { color: COLORS.text, fontWeight: '700', fontSize: 12 },

  /* Quick actions */
  actionsGrid: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 10,
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 14,
  },
  quickAction: {
    width: '30%',
    aspectRatio: 1,
    backgroundColor: '#FFF8F6',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
  },
  quickIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: '#FFE1D7',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickLabel: { fontSize: 12, color: COLORS.text, textAlign: 'center', fontWeight: '600' },

  /* Logout */
  logoutBtn: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: '#FFF2F2',
    borderWidth: 1,
    borderColor: COLORS.border,
    marginTop: 8,
  },
  logoutText: { color: COLORS.danger, fontWeight: '700' },

  /* FAB */
  fab: {
    position: 'absolute',
    right: 16,
    bottom: 16,
    backgroundColor: COLORS.primaryDark,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 12 },
});
