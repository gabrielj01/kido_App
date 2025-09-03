import React, { useMemo, useState } from 'react';
import { View, Text, Button, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {colors} from '../../../theme/color';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS = ['08:00 - 12:00','12:00 - 16:00','16:00 - 20:00','20:00 - 00:00'];

export default function SitterStep4() {
  const navigation = useNavigation();
  const route = useRoute();

  // availability as { [day]: slot }
  const [availability, setAvailability] = useState(() => {
    const arr = route.params?.availability || []; // [{day, hours}]
    const map = {};
    arr.forEach(({day, hours}) => { map[day] = hours; });
    return map;
  });

  const toggleDay = (day) => {
    setAvailability((prev) => {
      const next = { ...prev };
      if (next[day]) delete next[day]; else next[day] = SLOTS[0];
      return next;
    });
  };

  const setSlot = (day, slot) => setAvailability((p)=>({ ...p, [day]: slot }));

  const canNext = useMemo(() => Object.keys(availability).length > 0, [availability]);

  const onNext = () => {
    const formatted = Object.entries(availability).map(([day, hours]) => ({ day, hours }));
    // For MVP, we serialize availability into bio suffix so backend can persist something human-readable
    const availabilityStr = formatted.map(i => `${i.day}: ${i.hours}`).join(' | ');
    const bioMerged = route.params?.bio
      ? `${route.params.bio}\nAvailability: ${availabilityStr}`
      : `Availability: ${availabilityStr}`;

    navigation.navigate('Signup', {
      ...route.params,
      availability: formatted,
      bio: bioMerged, // store inside bio (MVP)
    });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Weekly Availability</Text>

      {DAYS.map((d) => {
        const checked = !!availability[d];
        return (
          <View key={d} style={{ borderWidth:1, borderColor:colors.border, borderRadius:10, padding:10, marginTop:10 }}>
            <Pressable onPress={() => toggleDay(d)}>
              <Text style={{ fontWeight:'700', color: colors.textDark }}>
                {checked ? '☑' : '☐'} {d}
              </Text>
            </Pressable>
            {checked && (
              <View style={{ flexDirection:'row', flexWrap:'wrap', marginTop:8 }}>
                {SLOTS.map((s) => (
                  <Pressable
                    key={s}
                    onPress={() => setSlot(d, s)}
                    style={{
                      paddingVertical:6, paddingHorizontal:10, borderWidth:1, borderColor:colors.border, borderRadius:8,
                      marginRight:6, marginBottom:6, backgroundColor: availability[d] === s ? colors.primary : '#fff'
                    }}
                  >
                    <Text style={{ color: availability[d] === s ? '#fff' : colors.textDark }}>{s}</Text>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        );
      })}

      <View style={{ marginTop:16 }}>
        <Button title="Review & Continue" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
