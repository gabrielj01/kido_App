import React, { useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  Pressable,
  Switch,
  Alert,
  RefreshControl,
} from 'react-native';
import { Ionicons, MaterialIcons, FontAwesome5 } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import RatingStars from '../../components/RatingStars';
import { getUpcomingBookings } from '../../api/bookingApi';
import { useFocusEffect } from '@react-navigation/native';
import Screen from '../../components/Screen';

export default function SitterHome({ navigation }) {
  // Optional-call is fine, but typical call is fine as well:
  const { user, logout } = useAuth?.() || { user: null, logout: () => {} };

  const [accepting, setAccepting] = useState(true);
  const [upcoming, setUpcoming] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  // Mock stats (replace with real)
  const stats = useMemo(
    () => ({
      jobs: 12,
      responseRate: 98,
      rating: 4.8,
      reviewsCount: 36,
      weekEarnings: 1280,
    }),
    []
  );

  // Load upcoming bookings from API
  const load = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const list = await getUpcomingBookings({ limit: 5, status: 'accepted' });
      setUpcoming(Array.isArray(list) ? list : []);
    } catch (e) {
      console.log('Load upcoming (sitter) failed:', e?.response?.data || e.message);
    } finally {
      if (!silent) setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Refetch when screen gains focus
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  // Pull-to-refresh handler
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  const firstName = user?.firstName || user?.name || 'Babysitter';

  // Safe navigation helper
  const tryNavigate = (routeName, params) => {
    try {
      if (navigation?.navigate) navigation.navigate(routeName, params);
      else Alert.alert('Navigation', `Wire this to "${routeName}" screen.`);
    } catch {
      Alert.alert('Navigation', `Screen "${routeName}" not found yet.`);
    }
  };

  return (
    <Screen edges={['top']}>
    <ScrollView
      contentContainerStyle={styles.scroll}
      bounces
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      {/* Header card */}
      <View style={styles.headerCard}>
        <View style={styles.headerRow}>
          <View style={styles.avatarWrap}>
            <Image
              source={{
                uri: user?.photoUrl || 'https://i.pravatar.cc/150?img=12',
              }}
              style={styles.avatar}
            />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={styles.welcome}>Hi, {firstName} 👋</Text>
            <View style={styles.ratingRow}>
              <RatingStars rating={stats.rating} size={16} />
              <Text style={styles.ratingText}>
                {stats.rating.toFixed(1)} · {stats.reviewsCount} reviews
              </Text>
            </View>

            <View style={styles.availabilityRow}>
              <Ionicons
                name={accepting ? 'checkmark-circle' : 'remove-circle'}
                size={18}
                color={accepting ? '#0EAD69' : '#C53F3F'}
              />
              <Text style={styles.availabilityText}>
                {accepting ? 'Accepting bookings' : 'Not accepting bookings'}
              </Text>
              <Switch value={accepting} onValueChange={setAccepting} />
            </View>
          </View>
        </View>

        {/* Quick stats */}
        <View style={styles.statsRow}>
          <StatCard icon="briefcase-outline" label="Jobs" value={String(stats.jobs)} />
          <StatCard icon="flash-outline" label="Response" value={`${stats.responseRate}%`} />
          <StatCard icon="star-outline" label="Rating" value={stats.rating.toFixed(1)} />
        </View>
      </View>

      {/* Quick actions */}
      <SectionHeader title="Quick actions" />
      <View style={styles.actionsGrid}>
        <QuickAction
          icon={<Ionicons name="calendar" size={22} color="#2E3A59" />}
          label="Calendar"
          onPress={() => tryNavigate('Calendar')}
        />
        <QuickAction
          icon={<Ionicons name="chatbubbles" size={22} color="#2E3A59" />}
          label="Requests"
          onPress={() => tryNavigate('Requests')}
        />
        <QuickAction
          icon={<MaterialIcons name="event-available" size={22} color="#2E3A59" />}
          label="Availability"
          onPress={() => tryNavigate('Availability')}
        />
        <QuickAction
          icon={<Ionicons name="card" size={22} color="#2E3A59" />}
          label="Payouts"
          onPress={() => tryNavigate('Payouts')}
        />
        <QuickAction
          icon={<Ionicons name="person-circle" size={22} color="#2E3A59" />}
          label="Profile"
          onPress={() => tryNavigate('Profile')}
        />
        <QuickAction
          icon={<FontAwesome5 name="star-half-alt" size={20} color="#2E3A59" />}
          label="Reviews"
          onPress={() =>
            tryNavigate('BabysitterReviews', {
              sitterId: user?._id || user?.id,
              sitterName: user?.name,
            })
          }
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
          title="No bookings yet"
          subtitle="Your confirmed bookings will appear here."
          actionLabel="Browse requests"
          onAction={() => tryNavigate('Requests')}
        />
      ) : (
        <View style={styles.card}>
          {upcoming.map((b, idx) => {
            // For sitter-side, show the parent/family name
            const start = new Date(b.startISO);
            const end = new Date(b.endISO);
            const dateStr = start.toLocaleDateString();
            const timeStr = `${start.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}–${end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            const parentName = b?.parentId?.name || '—';
            return (
              <View
                key={b._id || String(idx)}
                style={[styles.bookingRow, idx < upcoming.length - 1 && styles.rowDivider]}
              >
                <View style={{ flex: 1 }}>
                  <Text style={styles.bookingPrimary}>
                    {dateStr} · {timeStr}
                  </Text>
                  <Text style={styles.bookingSecondary}>With {parentName}</Text>
                </View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Pressable
                    style={styles.bookingAction}
                    onPress={() => tryNavigate('BookingDetails', { id: b._id })}
                  >
                    <Text style={styles.bookingActionText}>Details</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Earnings */}
      <SectionHeader title="Earnings" />
      <View style={[styles.card, styles.earningsCard]}>
        <View style={{ flex: 1 }}>
          <Text style={styles.earningsTitle}>This week</Text>
          <Text style={styles.earningsValue}>₪{stats.weekEarnings}</Text>
          <Text style={styles.earningsSub}>Sep 1–Sep 7</Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={() => tryNavigate('Payouts')}>
          <Ionicons name="arrow-forward" size={18} color="#fff" />
          <Text style={styles.primaryBtnText}>Go to Payouts</Text>
        </Pressable>
      </View>

      {/* Logout */}
      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Ionicons name="log-out-outline" size={18} color="#C53F3F" />
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>

      {/* Spacer */}
      <View style={{ height: 24 }} />
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

function StatCard({ icon, label, value }) {
  return (
    <View style={styles.statCard}>
      <Ionicons name={icon} size={18} color="#2E3A59" />
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
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

const COLORS = {
  bg: '#F6FAFF',
  card: '#FFFFFF',
  text: '#2E3A59',
  textMuted: '#6B7A99',
  border: '#E6ECF5',
  primary: '#FF7A59',
  primaryDark: '#FF5C36',
  accent: '#6EDCCF',
  success: '#0EAD69',
  danger: '#C53F3F',
};

const styles = StyleSheet.create({
  scroll: {
    padding: 16,
    backgroundColor: COLORS.bg,
  },
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
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarWrap: {
    width: 62,
    height: 62,
    borderRadius: 31,
    backgroundColor: '#FFE8E0',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    overflow: 'hidden',
  },
  avatar: {
    width: 62,
    height: 62,
  },
  welcome: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  ratingText: {
    fontSize: 13,
    color: COLORS.textMuted,
  },
  availabilityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  availabilityText: {
    color: COLORS.text,
    fontSize: 13,
    marginRight: 8,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: '#FDF3F0',
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    gap: 4,
  },
  statLabel: { fontSize: 12, color: COLORS.textMuted },
  statValue: { fontSize: 16, fontWeight: '700', color: COLORS.text },

  sectionHeader: {
    marginTop: 10,
    marginBottom: 8,
    paddingHorizontal: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
  },

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
  quickLabel: {
    fontSize: 12,
    color: COLORS.text,
    textAlign: 'center',
    fontWeight: '600',
  },

  card: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 12,
    marginBottom: 14,
  },
  bookingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 10,
  },
  rowDivider: {
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  bookingPrimary: {
    color: COLORS.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 2,
  },
  bookingSecondary: {
    color: COLORS.textMuted,
    fontSize: 12,
  },
  bookingAction: {
    backgroundColor: '#FFF1ED',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  bookingActionText: {
    color: COLORS.text,
    fontWeight: '600',
    fontSize: 12,
  },

  earningsCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  earningsTitle: { color: COLORS.textMuted, fontSize: 12 },
  earningsValue: { color: COLORS.text, fontSize: 22, fontWeight: '800', marginTop: 2 },
  earningsSub: { color: COLORS.textMuted, fontSize: 12, marginTop: 2 },

  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  primaryBtnText: { color: '#fff', fontWeight: '700' },

  secondaryBtn: {
    backgroundColor: '#FFF8F6',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignSelf: 'center',
    marginTop: 8,
  },
  secondaryBtnText: { color: COLORS.text, fontWeight: '700' },

  emptyCard: {
    backgroundColor: COLORS.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: COLORS.border,
    padding: 16,
    alignItems: 'center',
    marginBottom: 14,
  },
  emptyTitle: { fontSize: 16, fontWeight: '700', color: COLORS.text },
  emptySubtitle: { fontSize: 12, color: COLORS.textMuted, marginTop: 6, textAlign: 'center' },

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
  },
  logoutText: { color: COLORS.danger, fontWeight: '700' },
});
