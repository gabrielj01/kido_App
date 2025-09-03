import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../../../theme/color';

export default function SitterStep2() {
  const navigation = useNavigation();
  const route = useRoute();

  const [age, setAge] = useState(route.params?.age ? String(route.params.age) : '');
  const [hourlyRate, setHourlyRate] = useState(route.params?.hourlyRate ? String(route.params.hourlyRate) : '');
  const [workArea, setWorkArea] = useState(route.params?.workArea ? String(route.params.workArea) : '');

  const canNext = useMemo(() => {
    const a = parseInt(age || '0', 10);
    const r = parseFloat(hourlyRate || '0');
    const w = parseFloat(workArea || '0');
    return a > 0 && r > 0 && w > 0;
  }, [age, hourlyRate, workArea]);

  const onNext = () => {
    navigation.navigate('SitterStep3', {
      ...route.params,
      age: parseInt(age, 10),
      hourlyRate: parseFloat(hourlyRate),
      workArea: parseFloat(workArea),
    });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Pricing & Work Area</Text>

      <TextInput
        placeholder="Age"
        value={age}
        onChangeText={(t) => setAge(t.replace(/[^\d]/g, ''))}
        keyboardType="number-pad"
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:10 }}
      />
      <TextInput
        placeholder="Hourly Rate (ILS/hour)"
        value={hourlyRate}
        onChangeText={(t) => setHourlyRate(t.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:10 }}
      />
      <TextInput
        placeholder="Work Area (km radius)"
        value={workArea}
        onChangeText={(t) => setWorkArea(t.replace(/[^\d.]/g, ''))}
        keyboardType="decimal-pad"
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:10 }}
      />

      <View style={{ marginTop:16 }}>
        <Button title="Next" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
