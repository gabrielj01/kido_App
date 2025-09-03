import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button, Pressable } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

// colors helper
let importedDefault, importedNS;
try { importedDefault = require('../../../theme/colors').default; importedNS = require('../../../theme/colors'); }
catch { importedDefault = null; importedNS = {}; }
const colors = importedNS?.colors || importedDefault || importedNS?.default || {
  primary:'#4E8AF0', textDark:'#1F2937', textLight:'#6B7280', bg:'#FFFFFF', border:'#E5E7EB'
};

export default function SitterStep3() {
  const navigation = useNavigation();
  const route = useRoute();

  const [experienceList, setExperienceList] = useState(route.params?.experienceList || [{ type:'', years:'' }]);

  const updateExp = (i, field, val) => {
    const next = [...experienceList];
    next[i] = { ...next[i], [field]: val };
    setExperienceList(next);
  };

  const addLine = () => setExperienceList((arr) => [...arr, { type:'', years:'' }]);
  const canNext = useMemo(
    () => experienceList.length > 0 && experienceList.every(e => e.type.trim() && String(e.years).trim()),
    [experienceList]
  );

  const onNext = () => {
    // flatten to a readable string for backend 'experience' (MVP)
    const expStr = experienceList.map(e => `${e.type} (${e.years} yrs)`).join(', ');
    navigation.navigate('SitterStep4', { ...route.params, experienceList, experience: expStr });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Experience</Text>

      {experienceList.map((e, i) => (
        <View key={i} style={{ marginTop:10 }}>
          <TextInput
            placeholder="Type of Care"
            value={e.type}
            onChangeText={(t)=>updateExp(i, 'type', t)}
            style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12 }}
          />
          <TextInput
            placeholder="Years of Experience"
            value={String(e.years)}
            onChangeText={(t)=>updateExp(i, 'years', t.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
            style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:6 }}
          />
        </View>
      ))}

      <Pressable onPress={addLine} style={{ marginTop:10 }}>
        <Text style={{ color: colors.primary, fontWeight:'700' }}>+ Add Experience</Text>
      </Pressable>

      <View style={{ marginTop:16 }}>
        <Button title="Next" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
