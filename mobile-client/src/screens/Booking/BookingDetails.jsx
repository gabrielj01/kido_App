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
  SafeAreaView,
} from 'react-native';
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

/* ---------------------------- *
 * Small helpers (compact)      *
 * ---------------------------- */
const pick = (...vals) => vals.find(v => {
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === 'string') return v.trim() !== '';
  if (typeof v === 'number') return Number.isFinite(v);
  if (v && typeof v === 'object') return Object.keys(v).length > 0;
  return false;
}) ?? null;

const toText = (v) => Array.isArray(v) ? v.map(String).join(', ') : (v ?? '');
const now = () => new Date();

const fmtRange = (bk) => {
  const sIso = pick(bk?.startISO, bk?.startTime, bk?.start);
  const eIso = pick(bk?.endISO,   bk?.endTime,   bk?.end);
  if (!sIso || !eIso) return '—';
  const s = new Date(sIso), e = new Date(eIso);
  const sameDay = s.toDateString() === e.toDateString();
  const d = s.toLocaleDateString('en-IL', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
  const st = s.toLocaleTimeString('en-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  const et = e.toLocaleTimeString('en-IL', { hour: '2-digit', minute: '2-digit', hour12: false });
  return sameDay ? `${d} • ${st} → ${et}` : `${d} • ${st} → ${e.toLocaleString('en-IL')}`;
};

const stepFrom = (status, start, end) => {
  if (!status) return 0;
  if (['cancelled','declined'].includes(status)) return 'cancelled';
  if (status === 'completed') return 3;
  const n = now(), before = start && n < start, after = end && n > end;
  if (status === 'pending') return 0;
  if (status === 'accepted' && before) return 1;
  if (status === 'accepted' && !before && !after) return 2;
  if (status === 'accepted' && after) return 3;
  return 0;
};

const sitterAvatar = (s) => pick(
  s?.photoUrl, s?.avatarUrl, s?.avatar, s?.profileImage?.url, s?.imageUrl, s?.photo
);

const kidsText = (k) => {
  if (!k) return '';
  if (Array.isArray(k)) {
    const parts = k.map(c =>
      typeof c === 'number' ? `${c}y` :
      typeof c === 'string' ? c :
      (c?.name ? (c?.age != null ? `${c.name} (${c.age}y)` : c.name) :
       (c?.age != null ? `${c.age}y` : ''))
    ).filter(Boolean);
    return `${k.length} kid${k.length===1?'':'s'}: ${parts.join(', ')}`;
  }
  return typeof k === 'number' ? `${k} kid${k===1?'':'s'}` : String(k);
};

const statusStyles = {
  pending:   { backgroundColor: '#A78BFA' },
  accepted:  { backgroundColor: '#22C55E' },
  declined:  { backgroundColor: '#EF4444' },
  cancelled: { backgroundColor: '#EF4444' },
  completed: { backgroundColor: '#0EA5E9' },
  default:   { backgroundColor: '#9CA3AF' },
};

export default function BookingDetails({ route, navigation }) {
  /* -------- Params: accept many shapes to avoid "missing id" -------- */
  const p = route?.params || {};
  const passedBooking = (p.booking && typeof p.booking === 'object') ? p.booking : null;
  const bookingId = typeof pick(p.bookingId, p.id, p._id, passedBooking?._id) === 'string'
    ? pick(p.bookingId, p.id, p._id, passedBooking?._id)
    : (typeof p.bookingId === 'object' ? p.bookingId?._id : null);

  const { user } = useAuth();

  const [booking, setBooking] = useState(passedBooking || null);
  const [loading, setLoading] = useState(!passedBooking);
  const [actsBusy, setActsBusy] = useState(false);
  const [confirm, setConfirm] = useState({ visible: false, action: null, title: '', message: '' });

  const load = useCallback(async () => {
    if (passedBooking?._id) { setBooking(passedBooking); setLoading(false); return; } // eslint-disable-line
    if (!bookingId) { setLoading(false); setBooking(null); return; }
    setLoading(true);
    try {
      const data = await getBookingById(bookingId);
      setBooking(data);
    } catch (e) {
      Alert.alert('Error', e?.response?.data?.error || e.message || 'Failed to load booking');
      setBooking(null);
    } finally { setLoading(false); }
  }, [bookingId, passedBooking]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <SafeAreaView style={[styles.safe, styles.center]}><ActivityIndicator/></SafeAreaView>;
  if (!booking) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.container}>
          <View style={styles.card}><Text style={styles.title}>Booking Details</Text>
            <Text style={[styles.value,{marginTop:8}]}>Unable to display this booking. No ID or data provided.</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  /* -------- Derived -------- */
  const isParent = String(user?.role || '').toLowerCase() === 'parent';
  const status = booking?.status || 'pending';

  const startISO = pick(booking?.startISO, booking?.startTime, booking?.start);
  const endISO   = pick(booking?.endISO,   booking?.endTime,   booking?.end);
  const start = startISO ? new Date(startISO) : null;
  const end   = endISO   ? new Date(endISO)   : null;

  const beforeStart = start && now() < start;
  const afterEnd    = end && now() > end;
  const terminal = ['cancelled','declined','completed'].includes(status);
  const step = stepFrom(status, start, end);

  const sitter =
    (booking?.babysitter && typeof booking.babysitter === 'object' ? booking.babysitter : null) ||
    (booking?.sitter && typeof booking.sitter === 'object' ? booking.sitter : null) ||
    (booking?.sitterId && typeof booking.sitterId === 'object' ? booking.sitterId : null) || {};
      const sitterId =
        (typeof booking?.sitterId === 'string' && booking.sitterId) ||
        (sitter?._id ? String(sitter._id) : (booking?.sitterId?._id ? String(booking.sitterId._id) : null));
  const sitterName = pick(sitter?.name, booking?.sitterName) || '—';
  const avatarUrl = sitterAvatar(sitter);
  const rate = pick(booking?.rateSnapshot, sitter?.hourlyRate);
  const expYears = pick(sitter?.experienceYears, sitter?.yearsOfExperience, sitter?.experience?.years);

  // Parent details (flat & compact)
  const kids = kidsText(pick(booking?.kids, booking?.children, booking?.details?.kids, booking?.parentForm?.kids));
  const dietary = toText(pick(booking?.dietaryPreferences, booking?.preferences?.dietary, booking?.details?.dietaryPreferences));
  const allergies = toText(pick(booking?.allergies, booking?.preferences?.allergies, booking?.details?.allergies));
  const bedtime = toText(pick(booking?.bedtime, booking?.preferences?.bedtime, booking?.details?.bedtime));
  const instructions = toText(pick(booking?.instructions, booking?.specialInstructions, booking?.details?.instructions));
  const pets = toText(pick(booking?.pets, booking?.details?.pets));
  const address = toText(pick(booking?.address, booking?.addressText, booking?.location?.address, booking?.details?.address));
  const gateCode = toText(pick(booking?.gateCode, booking?.doorCode, booking?.details?.gateCode));
  const eName = toText(pick(booking?.emergencyContactName, booking?.emergencyContact?.name, booking?.details?.emergencyContact?.name));
  const ePhone = toText(pick(booking?.emergencyContactPhone, booking?.emergencyContact?.phone, booking?.details?.emergencyContact?.phone));

  const hasFamily = !!(kids || dietary || allergies || bedtime || instructions || pets);
  const hasLogistics = !!(address || gateCode || eName || ePhone);

  // Permissions
  const canCancel = ['pending','accepted'].includes(status) && !!beforeStart;
  const canDecide = !isParent && status === 'pending';
  const canComplete = !isParent && status === 'accepted' && !!afterEnd;

  /* -------- Actions (compact) -------- */
  const doAction = async (fn, args = [], goBack = false) => {
    setActsBusy(true);
    try { await fn(...args); goBack ? navigation.goBack() : await load(); }
    catch (e) { Alert.alert('Error', e?.response?.data?.error || e.message); }
    finally { setActsBusy(false); setConfirm({ visible: false, action: null }); }
  };

  /* -------- UI -------- */
  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView
        contentContainerStyle={[styles.container,{paddingBottom:140}]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.card}>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Booking Details</Text>
            <View style={[styles.badge, statusStyles[status] || statusStyles.default]}>
              <Text style={styles.badgeText}>{String(status).toUpperCase()}</Text>
            </View>
          </View>

          <View style={styles.row}>
            <MaterialIcons name="schedule" size={20} color={colors.textLight} />
            <Text style={styles.when}>{fmtRange(booking)}</Text>
          </View>

          <View style={styles.row}>
            <Ionicons name="cash-outline" size={20} color={colors.textLight} />
            <Text style={styles.price}>
              {booking.totalHours ?? '—'} h × ₪{(booking.rateSnapshot ?? sitter?.hourlyRate ?? '—')}/h ={' '}
              <Text style={styles.priceStrong}>₪{booking.totalPrice ?? '—'}</Text>
            </Text>
          </View>

          {!!booking.notes && (
            <View style={{ marginTop: 10 }}>
              <Text style={styles.label}>Notes</Text>
              <Text style={styles.value}>{booking.notes}</Text>
            </View>
          )}
        </View>

        {/* Stepper (super simple) */}
        <View style={styles.stepCard}>
          {step === 'cancelled' ? (
            <View style={styles.stepRow}>
              <Ionicons name="close-circle" size={18} color={'#EF4444'} />
              <Text style={[styles.stepText,{color:'#EF4444'}]}>
                {status === 'declined' ? 'Declined' : 'Cancelled'}
              </Text>
            </View>
          ) : (
            <View style={styles.stepCol}>
              {['Pending','Accepted','In progress','Completed'].map((label, i) => {
                const active = typeof step === 'number' && i <= step;
                return (
                  <View key={label} style={styles.stepRow}>
                    <View style={[styles.dot, active && styles.dotActive]}>
                      {active ? <Ionicons name="checkmark" size={12} color="#fff" /> : null}
                    </View>
                    <Text style={[styles.stepText, active && styles.stepActive]}>{label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* Babysitter */}
        <View style={styles.infoCard}>
          <View style={styles.sitterRow}>
            {avatarUrl ? (
              <Image source={{ uri: avatarUrl }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}><Ionicons name="person" size={20} color="#fff" /></View>
            )}

            <View style={{ flex:1 }}>
              <Text style={styles.sitterName}>{sitterName}</Text>
              <View style={styles.metaRow}>
                {rate != null && <MetaPill icon="cash-outline" text={`₪${rate}/h`} />}
                {typeof expYears === 'number' && <MetaPill icon="briefcase-outline" text={`${expYears} year${expYears===1?'':'s'}`} />}
              </View>
            </View>

            {!!sitterId && (
              <Pressable
              style={styles.viewBtn} 
              hitSlop={8}
              onPress={() => {
                  if (!sitterId) return;
                  navigation.navigate('BabysitterReviews', {
                    babysitterId: sitterId,
                    userId: sitterId,
                    forUserId: sitterId,
                    role: 'babysitter',
                  });
                }}
              >
                <Text style={styles.viewBtnText}>View Babysitter's reviews</Text>
                <Ionicons name="chevron-forward" size={16} color={colors.primary || '#7E57C2'} />
              </Pressable>
            )}
          </View>
        </View>

        {/* Parent details */}
        {hasFamily && (
          <View style={styles.infoCard}>
            <Text style={[styles.title,{marginBottom:8}]}>Family & preferences</Text>
            {!!kids && <DetailRow icon="people-outline" text={kids} />}
            {!!dietary && <DetailRow icon="restaurant-outline" text={dietary} />}
            {!!allergies && <DetailRow icon="bandage-outline" text={allergies} />}
            {!!bedtime && <DetailRow icon="moon-outline" text={bedtime} />}
            {!!instructions && <DetailRow icon="document-text-outline" text={instructions} />}
            {!!pets && <DetailRow icon="paw-outline" text={pets} />}
          </View>
        )}

        {hasLogistics && (
          <View style={styles.infoCard}>
            <Text style={[styles.title,{marginBottom:8}]}>Address</Text>
            {!!address && <DetailRow icon="home-outline" text={address} />}
            {!!gateCode && <DetailRow icon="key-outline" text={`Gate/door code: ${gateCode}`} />}
            {(eName || ePhone) && (
              <DetailRow icon="call-outline" text={`Emergency contact${eName ? `: ${eName}` : ''}${ePhone ? ` (${ePhone})` : ''}`} />
            )}
          </View>
        )}
      </ScrollView>

      {/* Footer actions (compact) */}
      <SafeAreaView style={styles.footerWrap}>
        <View style={styles.footer}>
          {(!isParent && status === 'pending') ? (
            <>
              <Btn text="Decline" kind="secondary" onPress={() => setConfirm({visible:true,action:'decline',title:'Decline booking?',message:'This will notify the parent.'})} busy={actsBusy}/>
              <Btn text="Accept"  kind="primary"  onPress={() => setConfirm({visible:true,action:'accept',title:'Accept booking?',message:'You can still cancel later if needed.'})} busy={actsBusy}/>
            </>
          ) : (['pending','accepted'].includes(status) && beforeStart) ? (
            <Btn text="Cancel" kind="warn" onPress={() => setConfirm({visible:true,action:'cancel',title:'Cancel booking?',message:'Are you sure you want to cancel this booking?'})} busy={actsBusy}/>
          ) : (!isParent && status === 'accepted' && afterEnd) ? (
            <Btn text="Mark as completed" kind="primary" onPress={() => setConfirm({visible:true,action:'complete',title:'Mark as completed?',message:'This will finalize the booking.'})} busy={actsBusy}/>
          ) : terminal ? (
            <Btn text="Remove from my list" kind="ghost" onPress={() => setConfirm({visible:true,action:'hide',title:'Remove from list?',message:'This hides the booking from your list.'})} busy={actsBusy}/>
          ) : null}
        </View>
      </SafeAreaView>

      {/* Confirm modal (routes to compact actions) */}
      <ConfirmModal
        visible={confirm.visible}
        title={confirm.title}
        message={confirm.message}
        onCancel={() => setConfirm({ visible:false, action:null })}
        onConfirm={async () => {
          const id = booking?._id || bookingId;
          if (confirm.action === 'cancel')   return doAction(cancelBooking, [id]);
          if (confirm.action === 'accept')   return doAction(sitterDecision, [id, 'accepted']);
          if (confirm.action === 'decline')  return doAction(sitterDecision, [id, 'declined']);
          if (confirm.action === 'complete') return doAction(completeBooking, [id]);
          if (confirm.action === 'hide')     return doAction(hideBookingById, [id], true);
        }}
        confirmText={actsBusy ? 'Please wait…' : 'Confirm'}
      />
    </SafeAreaView>
  );
}

/* ---------------------------- *
 * Small presentational bits    *
 * ---------------------------- */
function MetaPill({ icon, text }) {
  return (
    <View style={styles.pill}>
      <Ionicons name={icon} size={14} color="#0F172A" />
      <Text style={styles.pillText}>{text}</Text>
    </View>
  );
}

function DetailRow({ icon, text }) {
  return (
    <View style={styles.detailRow}>
      <Ionicons name={icon} size={18} color="#6B7280" />
      <Text style={styles.value}>{text}</Text>
    </View>
  );
}

function Btn({ text, kind, onPress, busy }) {
  const style = {
    primary:  [styles.cta, styles.ctaPrimary],
    secondary:[styles.cta, styles.ctaSecondary],
    warn:     [styles.cta, styles.ctaWarn],
    ghost:    [styles.cta, styles.ctaGhost],
  }[kind] || [styles.cta, styles.ctaPrimary];
  const label = {
    primary:  styles.ctaPrimaryText,
    secondary:styles.ctaSecondaryText,
    warn:     styles.ctaWarnText,
    ghost:    styles.ctaGhostText,
  }[kind] || styles.ctaPrimaryText;
  return (
    <Pressable onPress={onPress} style={style} disabled={busy}>
      <Text style={label}>{busy ? 'Please wait…' : text}</Text>
    </Pressable>
  );
}

/* ---------------------------- *
 *            Styles            *
 * ---------------------------- */
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.appBg || '#FFF9F2' },
  center: { alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 12 },

  card: {
    backgroundColor: colors.card || '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: colors.border || '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 }, elevation: 2,
  },

  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: colors.textDark || '#111827' },
  badge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { color: '#fff', fontWeight: '700', fontSize: 12, letterSpacing: 0.5 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 10 },
  when: { color: colors.textDark || '#111827', fontWeight: '600' },
  price: { color: colors.textDark || '#111827' },
  priceStrong: { fontWeight: '800', color: colors.primary || '#7E57C2' },

  stepCard: {
    backgroundColor: '#FFF', borderRadius: 16, paddingVertical: 12, paddingHorizontal: 12,
    borderWidth: 1, borderColor: '#E5E7EB',
  },
  stepCol: { gap: 10 },
  stepRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  stepText: { color: '#6B7280', fontWeight: '600' },
  stepActive: { color: colors.textDark || '#111827' },
  dot: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, borderColor: '#E5E7EB', alignItems: 'center', justifyContent: 'center' },
  dotActive: { backgroundColor: colors.primary || '#7E57C2', borderColor: colors.primary || '#7E57C2' },

  sitterRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: '#E5E7EB' },
  avatarFallback: { backgroundColor: colors.primary || '#7E57C2', alignItems: 'center', justifyContent: 'center' },
  sitterName: { fontSize: 16, fontWeight: '800', color: '#111827' },
  metaRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 6 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999, backgroundColor: '#F3F4F6', borderWidth: 1, borderColor: '#E5E7EB' },
  pillText: { color: '#0F172A', fontWeight: '700', fontSize: 12 },

  viewBtn: { paddingVertical: 8, paddingHorizontal: 10, borderRadius: 10, borderWidth: 1, borderColor: '#E5E7EB', backgroundColor: '#F8FAFC', flexDirection: 'row', alignItems: 'center', gap: 6 },
  viewBtnText: { color: colors.primary || '#7E57C2', fontWeight: '800' },

  detailRow: { flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 8 },
  label: { fontSize: 12, color: colors.textLight || '#6B7280', textTransform: 'uppercase', letterSpacing: 0.6 },
  value: { marginTop: 2, fontSize: 16, color: colors.textDark || '#111827', flex: 1, flexWrap: 'wrap' },

  footerWrap: { backgroundColor: 'transparent' },
  footer: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    paddingHorizontal: 16, paddingTop: 10, paddingBottom: Platform.select({ ios: 8, android: 16 }),
    backgroundColor: colors.card || '#FFFFFF',
    borderTopWidth: 1, borderTopColor: colors.border || '#E5E7EB',
    flexDirection: 'row', gap: 10,
  },
  cta: { flex: 1, paddingVertical: 12, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  ctaPrimary: { backgroundColor: colors.primary || '#7E57C2' },
  ctaPrimaryText: { color: '#fff', fontWeight: '800' },
  ctaSecondary: { backgroundColor: '#FFF', borderWidth: 1, borderColor: colors.border || '#E5E7EB' },
  ctaSecondaryText: { color: colors.textDark || '#111827', fontWeight: '800' },
  ctaWarn: { backgroundColor: '#e61515ff' },
  ctaWarnText: { color: '#fff', fontWeight: '800' },
  ctaGhost: { backgroundColor: '#FFF' },
  ctaGhostText: { color: colors.textDark || '#111827', fontWeight: '800' },
});
