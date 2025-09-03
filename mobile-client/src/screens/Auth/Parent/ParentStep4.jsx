import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import {colors} from '../../../theme/color';

export default function ParentStep4() {
  const navigation = useNavigation();
  const route = useRoute();
  const [prefs, setPrefs] = useState(route.params?.sitterPreferences || '');

  const canNext = useMemo(() => prefs.trim().length > 0, [prefs]);

  const onNext = () => {
    // Go to final review screen (Signup)
    navigation.navigate('Signup', { ...route.params, sitterPreferences: prefs.trim() });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Babysitter Preferences</Text>
      <TextInput
        placeholder="Gender, languages, certifications…"
        value={prefs}
        onChangeText={setPrefs}
        multiline
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:10, minHeight:100, textAlignVertical:'top' }}
      />
      <View style={{ marginTop:16 }}>
        <Button title="Review & Continue" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
