import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import colors from '../../../theme/color'; 
export default function ParentStep3() {
  const navigation = useNavigation();
  const route = useRoute();
  const [needs, setNeeds] = useState(route.params?.needs || '');

  const canNext = useMemo(() => needs.trim().length > 0, [needs]);

  const onNext = () => {
    navigation.navigate('ParentStep4', { ...route.params, needs: needs.trim() });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor:colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Special Needs</Text>
      <TextInput
        placeholder="Allergies, education, routines…"
        value={needs}
        onChangeText={setNeeds}
        multiline
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:12, marginTop:10, minHeight:120, textAlignVertical:'top' }}
      />
      <View style={{ marginTop:16 }}>
        <Button title="Next" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
