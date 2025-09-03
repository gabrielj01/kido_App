import React from "react";
import { Modal, View, Text, Pressable } from "react-native";
import { colors } from "../theme/color";

export default function ConfirmModal({
  visible,
  title = "Confirm",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
}) {
  return (
    <Modal visible={visible} transparent animationType="fade">
      <View
        style={{
          flex: 1,
          backgroundColor: "rgba(0,0,0,0.35)",
          alignItems: "center",
          justifyContent: "center",
          padding: 20,
        }}
      >
        <View
          style={{
            backgroundColor: colors.card,
            padding: 18,
            borderRadius: 16,
            width: "100%",
            maxWidth: 420,
          }}
        >
          <Text style={{ fontSize: 18, fontWeight: "700", color: colors.textDark }}>
            {title}
          </Text>
          {!!message && (
            <Text style={{ marginTop: 8, color: colors.textLight }}>{message}</Text>
          )}

          <View style={{ flexDirection: "row", justifyContent: "flex-end", marginTop: 18 }}>
            <Pressable
              onPress={onCancel}
              style={{ paddingVertical: 10, paddingHorizontal: 14, marginRight: 8 }}
            >
              <Text style={{ color: colors.textLight }}>{cancelText}</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              style={{
                paddingVertical: 10,
                paddingHorizontal: 14,
                backgroundColor: colors.primary,
                borderRadius: 10,
              }}
            >
              <Text style={{ color: "white", fontWeight: "600" }}>{confirmText}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}
