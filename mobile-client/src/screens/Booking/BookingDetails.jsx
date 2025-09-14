import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
  Pressable,
  Alert,
  Image,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../hooks/useAuth';
import {
  getBookingById,
  cancelBooking,
  hideBookingById,
  sitterDecision,
  completeBooking,
} from '../../api/bookingApi';
import ConfirmModal from '../../components/ConfirmModal';
import { colors } from '../../theme/color';

/* ----------------------------
 * Helpers: date formatting, steps, etc.
 * --------------------------- */

// Format booking range nicely for en-IL (Israel, 24h clock)
function fmtRange(startISO, endISO) {
  const s = new Date(startISO),
    e = new Date(endISO);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString('en-IL', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const st = s.toLocaleTimeString('en-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  const et = e.toLocaleTimeString('en-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return sameDay ? `${d} • ${st} → ${et}` : `${d} • ${st} → ${e.toLocaleString('en-IL')}`;
}
const now = () => new Date();

/** Map booking.status + time to a visual step index */
function computeStep(status, start, end) {
  // Steps: 0 Pending, 1 Accepted, 2 In progress, 3 Completed
  if (!status) return 0;
  if (status === 'cancelled' || status === 'declined') return 'cancelled';
  if (status === 'completed') return 3;

  const n = now();
  const beforeStart = start ? n < start : false;
  const afterEnd = end ? n > end : false;

  if (status === 'pending') return 0;
  if (status === 'accepted' && beforeStart) return 1;
  if (status === 'accepted' && !beforeStart && !afterEnd) return 2; // in progress
  if (status === 'accepted' && afterEnd) return 3; // should be completed, but awaiting action
  return 0;
}

/* ----------------------------
 * Screen
 * --------------------------- */
export default function BookingDetails({ route, navigation }) {
  const bookingId = route?.params?.bookingId;
  const { user } = useAuth();

  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actLoading, setActLoading] = useState(false);

  const [confirm, setConfirm] = useState({ visible: false, action: null, title: '', message: '' });

  const load = useCallback(async () => {
    if (!bookingId) {
      Alert.alert('Error', 'Missing bookingId');
      return;
    }
    setLoading(true);
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setLoading(false);
    }
  }, [bookingId]);

  useEffect(() => {
    load();
  }, [load]);

  const isParent = useMemo(() => String(user?.role).toLowerCase() === 'parent', [user]);
  const isSitter = !isParent;

  // Derived flags
  const status = booking?.status;
  const start = booking ? new Date(booking.startISO || booking.startTime) : null;
  const end = booking ? new Date(booking.endISO || booking.endTime) : null;
  const beforeStart = start ? now() < start : false;
  const afterEnd = end ? now() > end : false;
  const terminal = ['cancelled', 'declined', 'completed'].includes(status);

  // Permissions (simple rules)
  const canCancel = ['pending', 'accepted'].includes(status) && beforeStart; // both roles
  const canDecide = isSitter && status === 'pending'; // sitter only
  const canComplete = isSitter && status === 'accepted' && afterEnd; // sitter only, after end

  // Actions
  const doCancel = async () => {
    setActLoading(true);
    try {
      await cancelBooking(bookingId);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setActLoading(false);
      setConfirm({ visible: false });
    }
  };

  const doAccept = async () => {
    setActLoading(true);
    try {
      await sitterDecision(bookingId, 'accepted');
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setActLoading(false);
      setConfirm({ visible: false });
    }
  };

  const doDecline = async () => {
    setActLoading(true);
    try {
      await sitterDecision(bookingId, 'declined');
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setActLoading(false);
      setConfirm({ visible: false });
    }
  };

  const doComplete = async () => {
    setActLoading(true);
    try {
      await completeBooking(bookingId);
      await load();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setActLoading(false);
      setConfirm({ visible: false });
    }
  };

  const doHide = async () => {
    setActLoading(true);
    try {
      await hideBookingById(bookingId);
      navigation.goBack();
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message);
    } finally {
      setActLoading(false);
      setConfirm({ visible: false });
    }
  };

  // Loading / not found states
  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { alignItems: 'center', justifyContent: 'center' }]}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <Text style={styles.emptyText}>Booking not found.</Text>
        </View>
      </SafeAreaView>
    );
  }

  const counterpart = isParent ? booking.sitterId : booking.parentId;

  // Babysitter info (robust fallbacks)
  const sitter = booking?.babysitter || booking?.sitterId || {};
  const sitterName = counterpart?.name || sitter?.name || '—';
  const avatar =
    sitter?.avatar ||
    sitter?.photoUrl ||
    sitter?.photo ||
    'https://i.pravatar.cc/200?img=5'; // harmless fallback avatar
  const rate = sitter?.hourlyRate ?? booking?.rateSnapshot ?? null;
  const certs = Array.isArray(sitter?.certifications) ? sitter.certifications : [];
  const languages = Array.isArray(sitter?.languages) ? sitter.languages : [];
  const expYears =
    sitter?.experienceYears ??
    sitter?.yearsOfExperience ??
    (typeof sitter?.experience === 'object' ? sitter?.experience?.years : undefined);

  const distanceKm = booking?.distanceKm; // if provided by your backend
  const step = computeStep(status, start, end);

  /* ----------------------------
   * UI
   * --------------------------- */

  const renderStepper = () => {
    if (step === 'cancelled') {
      return (
        <View style={styles.stepperCard}>
          <View style={styles.stepRow}>
            <Ionicons name="close-circle" size={18} color={colors.danger || '#EF4444'} />
            <Text style={[styles.stepLabel, { color: colors.danger || '#EF4444' }]}>
              {status === 'declined' ? 'Declined' : 'Cancelled'}
            </Text>
          </View>
        </View>
      );
    }

    const all = ['Pending', 'Accepted', 'In progress', 'Completed'];
    return (
      <View style={styles.stepperCard}>
        <View style={styles.stepperTrack}>
          {all.map((label, idx) => {
            const active = typeof step === 'number' && idx <= step;
            return (
              <View key={label} style={styles.stepItem}>
                <View style={[styles.stepDot, active && styles.stepDotActive]}>
                  {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                </View>
                <Text style={[styles.stepLabel, active && styles.stepLabelActive]}>{label}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  };

  const renderFooterActions = () => {
    // Sticky footer with the right set of CTAs
    return (
      <SafeAreaView edges={['bottom']} style={styles.footerWrap}>
        <View style={styles.footerBar}>
          {canDecide && (
            <>
              <Pressable
                style={[styles.ctaBtn, styles.ctaSecondary, actLoading && styles.disabled]}
                onPress={() =>
                  setConfirm({
                    visible: true,
                    action: 'decline',
                    title: 'Decline booking?',
                    message: 'This will notify the parent.',
                  })
                }
                disabled={actLoading}
                hitSlop={8}
              >
                <Text style={[styles.ctaSecondaryText]}>Decline</Text>
              </Pressable>
              <Pressable
                style={[styles.ctaBtn, styles.ctaPrimary, actLoading && styles.disabled]}
                onPress={() =>
                  setConfirm({
                    visible: true,
                    action: 'accept',
                    title: 'Accept booking?',
                    message: 'You can still cancel later if needed.',
                  })
                }
                disabled={actLoading}
                hitSlop={8}
              >
                <Text style={styles.ctaPrimaryText}>Accept</Text>
              </Pressable>
            </>
          )}

          {!canDecide && canCancel && (
            <Pressable
              style={[styles.ctaBtn, styles.ctaWarn, actLoading && styles.disabled]}
              onPress={() =>
                setConfirm({
                  visible: true,
                  action: 'cancel',
                  title: 'Cancel booking?',
                  message: 'Are you sure you want to cancel this booking?',
                })
              }
              disabled={actLoading}
              hitSlop={8}
            >
              <Text style={styles.ctaWarnText}>Cancel</Text>
            </Pressable>
          )}

          {canComplete && (
            <Pressable
              style={[styles.ctaBtn, styles.ctaPrimary, actLoading && styles.disabled]}
              onPress={() =>
                setConfirm({
                  visible: true,
                  action: 'complete',
                  title: 'Mark as completed?',
                  message: 'This will finalize the booking.',
                })
              }
              disabled={actLoading}
              hitSlop={8}
            >
              <Text style={styles.ctaPrimaryText}>Mark as completed</Text>
            </Pressable>
          )}

          {terminal && (
            <Pressable
              style={[styles.ctaBtn, styles.ctaGhost, actLoading && styles.disabled]}
              onPress={() =>
                setConfirm({
                  visible: true,
                  action: 'hide',
                  title: 'Remove from list?',
                  message:
                    'This hides the booking from your list (does not delete it server-wide). You can still find it in your history.',
                })
              }
              disabled={actLoading}
              hitSlop={8}
            >
              <Text style={styles.ctaGhostText}>Remove from my list</Text>
            </Pressable>
          )}
        </View>
      </SafeAreaView>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container, { paddingBottom: 140 }]} // leave space for sticky footer
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header card */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Booking Details</Text>
            <View style={[styles.badge, statusStyles[status] || statusStyles.default]}>
              <Text style={styles.badgeText}>{String(status).toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.whenRow}>
            <MaterialIcons name="schedule" size={20} color={colors.textLight} />
            <Text style={styles.whenText}>{fmtRange(booking.startISO, booking.endISO)}</Text>
          </View>

          <View style={styles.priceRow}>
            <Ionicons name="cash-outline" size={20} color={colors.textLight} />
            <Text style={styles.priceText}>
              {booking.totalHours ?? '—'} h × ₪{booking.rateSnapshot ?? '—'}/h ={' '}
              <Text style={styles.totalStrong}>₪{booking.totalPrice ?? '—'}</Text>
            </Text>
          </View>

          {booking.notes ? (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value}>{booking.notes}</Text>
            </View>
          ) : null}
        </View>

        {/* Stepper */}
        {renderStepper()}

        {/* Babysitter mini-card */}
        <View style={styles.cardInfo}>
          <View style={styles.sitterRow}>
            <View style={styles.avatarWrap}>
              {avatar ? (
                <Image source={{ uri: avatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatar, styles.avatarFallback]}>
                  <Ionicons name="person" size={20} color="#fff" />
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.sitterName}>{sitterName}</Text>

              <View style={styles.miniMetaRow}>
                {rate != null && (
                  <View style={styles.metaPill}>
                    <Ionicons name="cash-outline" size={14} color="#0F172A" />
                    <Text style={styles.metaPillText}>₪{rate}/h</Text>
                  </View>
                )}
                {typeof expYears === 'number' && expYears >= 0 && (
                  <View style={styles.metaPill}>
                    <Ionicons name="briefcase-outline" size={14} color="#0F172A" />
                    <Text style={styles.metaPillText}>
                      {expYears} year{expYears === 1 ? '' : 's'}
                    </Text>
                  </View>
                )}
                {typeof distanceKm === 'number' && (
                  <View style={styles.metaPill}>
                    <Ionicons name="navigate-outline" size={14} color="#0F172A" />
                    <Text style={styles.metaPillText}>{distanceKm.toFixed(1)} km</Text>
                  </View>
                )}
              </View>
            </View>

            <Pressable
              style={styles.viewProfileBtn}
              onPress={() => navigation.navigate('BabysitterDetails', { babysitterId: sitter?._id || sitter?.id })}
              hitSlop={8}
            >
              <Text style={styles.viewProfileText}>View profile</Text>
              <Ionicons name="chevron-forward" size={16} color={colors.primary || '#7E57C2'} />
            </Pressable>
          </View>

          {!!languages.length && (
            <View style={styles.infoRowWrap}>
              <Ionicons name="globe-outline" size={18} color="#6B7280" />
              <View style={styles.chipsRow}>
                {languages.slice(0, 4).map((lang, i) => (
                  <View key={i} style={styles.chip}>
                    <Text style={styles.chipText}>{String(lang)}</Text>
                  </View>
                ))}
                {languages.length > 4 && (
                  <View style={[styles.chip, { opacity: 0.8 }]}>
                    <Text style={styles.chipText}>+{languages.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {!!certs.length && (
            <View style={styles.infoRowWrap}>
              <Ionicons name="ribbon-outline" size={18} color="#6B7280" />
              <View style={styles.chipsRow}>
                {certs.slice(0, 4).map((c, i) => (
                  <View key={i} style={[styles.chip, styles.certChip]}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#0EA5E9" />
                    <Text style={styles.chipText}>{String(c)}</Text>
                  </View>
                ))}
                {certs.length > 4 && (
                  <View style={[styles.chip, { opacity: 0.8 }]}>
                    <Text style={styles.chipText}>+{certs.length - 4}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </View>

        {/* Spacer at end of content so it doesn't hide behind the footer */}
        <View style={{ height: 8 }} />
      </ScrollView>

      {/* Sticky footer */}
      {renderFooterActions()}

      {/* Confirmations */}
      <ConfirmModal
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        onCancel={() => setConfirm({ visible: false })}
        onConfirm={async () => {
          if (confirm.action === 'cancel') return doCancel();
          if (confirm.action === 'accept') return doAccept();
          if (confirm.action === 'decline') return doDecline();
          if (confirm.action === 'complete') return doComplete();
          if (confirm.action === 'hide') return doHide();
          setConfirm({ visible: false });
        }}
        confirmText={actLoading ? 'Please wait…' : 'Confirm'}
      />
    </SafeAreaView>
  );
}

/* ----------------------------
 * Styles
 * --------------------------- */

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg || '#FFF9F2' },

  container: { padding: 16, gap: 12 },

  // Cards
  card: {
    backgroundColor: colors.card || '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  cardInfo: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    marginTop: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },

  // Header
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.textDark || '#111827' },

  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: 'white', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

  label: { fontSize: 12, color: colors.textLight || '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { marginTop: 4, fontSize: 16, color: colors.textDark || '#111827' },

  whenRow: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  whenText: { color: colors.textDark || '#111827', fontWeight: '600' },

  priceRow: { marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  priceText: { color: colors.textDark || '#111827' },
  totalStrong: { fontWeight: '800', color: colors.primary || '#7E57C2' },

  // Stepper
  stepperCard: {
    backgroundColor: '#FFF',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  stepperTrack: { flexDirection: 'column', gap: 10 },
  stepItem: { flexDirection: 'row', alignItems: 'center' },
  stepDot: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF',
  },
  stepDotActive: { backgroundColor: colors.primary || '#7E57C2', borderColor: colors.primary || '#7E57C2' },
  stepLabel: { marginLeft: 8, color: '#6B7280', fontWeight: '600' },
  stepLabelActive: { color: colors.textDark || '#111827' },
  stepLine: { flex: 1, height: 2, backgroundColor: '#E5E7EB', marginHorizontal: 8, borderRadius: 999 },
  stepLineActive: { backgroundColor: colors.primary || '#7E57C2' },
  stepRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },

  // Babysitter section
  sitterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatarWrap: { width: 52, height: 52, borderRadius: 26, overflow: 'hidden', backgroundColor: '#E5E7EB' },
  avatar: { width: 52, height: 52, borderRadius: 26 },
  avatarFallback: { backgroundColor: colors.primary || '#7E57C2', alignItems: 'center', justifyContent: 'center' },
  sitterName: { fontSize: 16, fontWeight: '800', color: '#111827' },

  miniMetaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  metaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  metaPillText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },

  viewProfileBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#F8FAFC',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  viewProfileText: { color: colors.primary || '#7E57C2', fontWeight: '800' },

  // Info rows and chips (reuse)
  infoRowWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    flexWrap: 'wrap',
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', flex: 1 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: '#F3F4F6',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  certChip: { backgroundColor: '#F0F9FF', borderColor: '#BAE6FD' },
  chipText: { color: '#111827', fontWeight: '600', fontSize: 12 },

  // Sticky footer
  footerWrap: {
    backgroundColor: 'transparent',
  },
  footerBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: Platform.select({ ios: 8, android: 16 }),
    backgroundColor: colors.card || '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: colors.border || '#E5E7EB',
    flexDirection: 'row',
    gap: 10,
  },
  ctaBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaPrimary: { backgroundColor: colors.primary || '#7E57C2' },
  ctaPrimaryText: { color: '#fff', fontWeight: '800' },
  ctaSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border || '#E5E7EB' },
  ctaSecondaryText: { color: colors.textDark || '#111827', fontWeight: '800' },
  ctaWarn: { backgroundColor: '#e61515ff' },
  ctaWarnText: { color: '#fff', fontWeight: '800' },
  ctaGhost: { backgroundColor: '#FFF' },
  ctaGhostText: { color: colors.textDark || '#111827', fontWeight: '800' },
  disabled: { opacity: 0.6 },

  // Misc
  emptyText: { color: colors.textLight || '#6B7280', fontWeight: '600' },
});

const statusStyles = {
  pending: { backgroundColor: '#A78BFA' },
  accepted: { backgroundColor: '#22C55E' },
  declined: { backgroundColor: '#EF4444' },
  cancelled: { backgroundColor: '#EF4444' },
  completed: { backgroundColor: '#0EA5E9' },
  default: { backgroundColor: '#9CA3AF' },
};