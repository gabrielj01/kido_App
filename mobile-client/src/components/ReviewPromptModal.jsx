// All comments in English as requested.
import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { colors } from "../theme/color";

export default function ReviewPromptModal({ visible, sitterName, onLater, onConfirm }) {
  if (!visible) return null;
  return (
    <Modal transparent animationType="fade" visible={visible}>
      <View style={{ flex:1, backgroundColor:"rgba(0,0,0,0.35)", justifyContent:"center", padding:24 }}>
        <View style={{ backgroundColor:"#fff", borderRadius:16, padding:18, borderWidth:1, borderColor:colors.border }}>
          <Text style={{ fontSize:18, fontWeight:"800", color:colors.textDark }}>Leave a review?</Text>
          <Text style={{ marginTop:8, color:colors.textLight }}>
            Your babysitting with {sitterName || "the sitter"} has ended. Would you like to leave a quick review?
          </Text>

          <View style={{ flexDirection:"row", justifyContent:"flex-end", marginTop:16 }}>
            <Pressable onPress={onLater} style={{ paddingVertical:10, paddingHorizontal:14, marginRight:8 }}>
              <Text style={{ color:colors.textDark, fontWeight:"700" }}>Later</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{ backgroundColor:colors.primary, paddingVertical:10, paddingHorizontal:14, borderRadius:10 }}
            >
              <Text style={{ color:"#fff", fontWeight:"800" }}>Review now</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
