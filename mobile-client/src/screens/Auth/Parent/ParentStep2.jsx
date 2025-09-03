import React, { useMemo, useState } from 'react';
import { View, Text, TextInput, Button } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';

// Robust theme import with fallback
let importedDefault, importedNS;
try { importedDefault = require('../../../theme/colors').default; importedNS = require('../../../theme/colors'); }
catch { importedDefault = null; importedNS = {}; }
const colors = importedNS?.colors || importedDefault || importedNS?.default || {
  primary:'#4E8AF0', textDark:'#1F2937', textLight:'#6B7280', bg:'#FFFFFF', border:'#E5E7EB'
};

export default function ParentStep2() {
  const navigation = useNavigation();
  const route = useRoute();

  // number of children + ages array
  const [numChildren, setNumChildren] = useState(route.params?.numChildren || 1);
  const [childrenAges, setChildrenAges] = useState(route.params?.childrenAges || ['']);

  // Keep childrenAges length in sync with numChildren
  const onChangeNum = (txt) => {
    const n = Math.max(1, Math.min(10, parseInt(txt || '1', 10)));
    setNumChildren(n);
    const next = [...childrenAges];
    if (n > next.length) next.push(...Array(n - next.length).fill(''));
    else next.splice(n);
    setChildrenAges(next);
  };

  const updateAge = (idx, val) => {
    const next = [...childrenAges];
    next[idx] = val;
    setChildrenAges(next);
  };

  const canNext = useMemo(
    () => childrenAges.slice(0, numChildren).every((a) => String(a).trim() !== ''),
    [childrenAges, numChildren]
  );

  const onNext = () => {
    navigation.navigate('ParentStep3', {
      ...route.params,
      numChildren,
      childrenAges: childrenAges.slice(0, numChildren),
    });
  };

  return (
    <View style={{ flex:1, padding:16, backgroundColor: colors.bg }}>
      <Text style={{ fontSize:18, fontWeight:'700', color:colors.textDark }}>Children Information</Text>

      <Text style={{ marginTop:12, color:colors.textLight }}>Number of children (1–10)</Text>
      <TextInput
        value={String(numChildren)}
        onChangeText={onChangeNum}
        keyboardType="number-pad"
        style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:10, marginTop:6 }}
      />

      {Array.from({ length: numChildren }).map((_, i) => (
        <TextInput
          key={i}
          placeholder={`Age of Child ${i + 1}`}
          keyboardType="number-pad"
          value={String(childrenAges[i] ?? '')}
          onChangeText={(t) => updateAge(i, t)}
          style={{ borderWidth:1, borderColor:colors.border, borderRadius:8, padding:10, marginTop:8 }}
        />
      ))}

      <View style={{ marginTop:16 }}>
        <Button title="Next" onPress={onNext} disabled={!canNext} />
      </View>
    </View>
  );
}
