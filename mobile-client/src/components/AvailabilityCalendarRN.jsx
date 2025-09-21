import React, { useMemo, useState } from 'react';
import { View, Text, Pressable, FlatList } from 'react-native';
import { Calendar } from 'react-native-calendars';

// Robust theme import with fallback
let importedDefault, importedNS;
try { importedDefault = require('../theme/colors').default; importedNS = require('../theme/colors'); }
catch { importedDefault = null; importedNS = {}; }
const colors = importedNS?.colors || importedDefault || importedNS?.default || {
  primary:'#4E8AF0', textDark:'#1F2937', textLight:'#6B7280',
  bg:'#FFFFFF', card:'#FFFFFF', border:'#E5E7EB', accent:'#FDE68A'
};

const SLOTS = ['08:00 - 12:00','12:00 - 16:00','16:00 - 20:00','20:00 - 00:00'];

// Dot colors per slot (distinct but soft)
const SLOT_COLORS = {
  '08:00 - 12:00': '#34D399',
  '12:00 - 16:00': '#60A5FA',
  '16:00 - 20:00': '#F59E0B',
  '20:00 - 00:00': '#F472B6',
};

const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']; // Date.getDay order
const NAME_TO_INDEX = { Sunday:0, Monday:1, Tuesday:2, Wednesday:3, Thursday:4, Friday:5, Saturday:6 };

// ---------- helpers ----------
const pad2 = (n) => (n < 10 ? `0${n}` : `${n}`);
function toKeyDate(d) {
  // returns YYYY-MM-DD
  return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`;
}

function addDays(base, n) {
  const d = new Date(base);
  d.setDate(d.getDate() + n);
  return d;
}

/** Normalize input
 * availability may be:
 *  - [{ day: 'Monday', hours: '08:00 - 12:00' }]
 *  - [{ day: 'Monday', hours: ['08:00 - 12:00','16:00 - 20:00'] }]
 * If missing, we try to parse from bio:
 *   "Availability: Monday: 08:00 - 12:00 | Tuesday: 16:00 - 20:00"
 * Returns Map<dayName, Set<slot>>
 */
function normalizeWeekly(availability, bio) {
  const map = new Map();
  for (const d of DAYS) map.set(d, new Set());

  if (Array.isArray(availability) && availability.length) {
    availability.forEach((row) => {
      const day = row?.day;
      if (!day || !NAME_TO_INDEX.hasOwnProperty(day)) return;
      const set = map.get(day) || new Set();
      const hours = Array.isArray(row.hours) ? row.hours : (row.hours ? [row.hours] : []);
      hours.forEach((h) => set.add(h));
      map.set(day, set);
    });
    return map;
  }

  if (typeof bio === 'string' && bio.includes('Availability:')) {
    try {
      const segment = bio.split('Availability:')[1];
      const parts = segment.split('|').map(s => s.trim()).filter(Boolean);
      parts.forEach((p) => {
        const [dayRaw, slotsRaw] = p.split(':').map(x => (x || '').trim());
        if (!NAME_TO_INDEX.hasOwnProperty(dayRaw)) return;
        const set = map.get(dayRaw) || new Set();
        slotsRaw?.split(',').map(s => s.trim()).forEach(s => s && set.add(s));
        map.set(dayRaw, set);
      });
    } catch { /* ignore */ }
  }
  return map;
}

/** Build markedDates for react-native-calendars, projecting weekly pattern
 * for the next `rangeDays` days (default 42 ≈ six weeks).
 */
function buildMarkedDates(weeklyMap, rangeDays = 42, startDate = new Date()) {
  const marked = {};
  for (let i = 0; i < rangeDays; i++) {
    const d = addDays(startDate, i);
    const key = toKeyDate(d);
    const dayName = DAYS[d.getDay()];
    const set = weeklyMap.get(dayName) || new Set();
    if (set.size > 0) {
      const dots = Array.from(set).map((slot) => ({
        key: `${dayName}-${slot}`,
        color: SLOT_COLORS[slot] || colors.primary,
        selectedDotColor: '#fff',
      }));
      marked[key] = { dots, marked: true };
    }
  }
  return marked;
}

// ---------- Component ----------
/**
 * Props:
 *  - availability: array [{ day, hours }] or with hours[]
 *  - bio: optional (fallback parser)
 *  - weeks: how many weeks to project (default 6)
 *  - onDateSelect(dateKey, slots[])
 */
export default function AvailabilityCalendarRN({ availability, bio, weeks = 6, onDateSelect }) {
  const weekly = useMemo(() => normalizeWeekly(availability, bio), [availability, bio]);
  const markedDates = useMemo(
    () => buildMarkedDates(weekly, weeks * 7, new Date()),
    [weekly, weeks]
  );

  const [selected, setSelected] = useState(null);       // 'YYYY-MM-DD'
  const [selectedSlots, setSelectedSlots] = useState([]); // ['08:00 - 12:00', …]

  // derive slots for a given date from weekly map
  const getSlotsForDate = (dateStr) => {
    const [y,m,d] = dateStr.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    const dayName = DAYS[dt.getDay()];
    const set = weekly.get(dayName) || new Set();
    return Array.from(set);
  };

  const onDayPress = (dayObj) => {
    const dateKey = dayObj.dateString; // YYYY-MM-DD
    const slots = getSlotsForDate(dateKey);
    setSelected(dateKey);
    setSelectedSlots(slots);
    if (onDateSelect) onDateSelect(dateKey, slots);
  };

  return (
    <View style={{ backgroundColor: colors.card, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' }}>
      <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border, backgroundColor: '#F8FAFC' }}>
        <Text style={{ color: colors.textDark, fontWeight: '800' }}>Weekly availability (projected)</Text>
        <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 2 }}>
          Tap a date to see available time slots
        </Text>
      </View>

      <Calendar
        markingType="multi-dot"
        markedDates={{
          ...markedDates,
          ...(selected ? { [selected]: { ...(markedDates[selected] || {}), selected: true, selectedColor: colors.primary } } : {}),
        }}
        onDayPress={onDayPress}
        theme={{
          textSectionTitleColor: colors.textLight,
          monthTextColor: colors.textDark,
          dayTextColor: colors.textDark,
          todayTextColor: colors.primary,
          selectedDayBackgroundColor: colors.primary,
          arrowColor: colors.textDark,
        }}
        style={{ borderBottomWidth: 1, borderBottomColor: colors.border }}
      />

      {/* Selected day slots */}
      <View style={{ padding: 12 }}>
        {selected ? (
          selectedSlots.length ? (
            <>
              <Text style={{ color: colors.textDark, fontWeight: '700', marginBottom: 8 }}>
                {selected} — available slots
              </Text>
              <FlatList
                data={selectedSlots}
                keyExtractor={(s) => s}
                horizontal
                showsHorizontalScrollIndicator={false}
                renderItem={({ item }) => (
                  <View style={{
                    paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10,
                    backgroundColor: SLOT_COLORS[item] || colors.accent, marginRight: 8
                  }}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{item}</Text>
                  </View>
                )}
              />
              <Text style={{ color: colors.textLight, fontSize: 12, marginTop: 8 }}>
                You can continue to booking to request this date & time.
              </Text>
            </>
          ) : (
            <Text style={{ color: colors.textLight }}>
              {selected}: no time slots available for this weekday.
            </Text>
          )
        ) : (
          <Text style={{ color: colors.textLight }}>
            Tip: select a date to preview slots.
          </Text>
        )}
      </View>

      {/* Legend */}
      <View style={{ padding: 12, borderTopWidth: 1, borderTopColor: colors.border }}>
        <Text style={{ color: colors.textLight, fontSize: 12, marginBottom: 6 }}>Legend</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
          {SLOTS.map((s) => (
            <View key={s} style={{ flexDirection:'row', alignItems:'center', marginRight: 12, marginBottom: 6 }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: SLOT_COLORS[s], marginRight: 6 }} />
              <Text style={{ color: colors.textLight, fontSize: 12 }}>{s}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}
