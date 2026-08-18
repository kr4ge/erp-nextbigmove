import { useEffect, useState } from 'react';
import { Feather } from '@expo/vector-icons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { tokens } from '@/src/shared/theme/tokens';
import type { WmsPackingProofFile } from '../types';

const MAX_INPUT_BYTES = 30 * 1024 * 1024;

type PackingProofModalProps = {
  error: string | null;
  isUploading: boolean;
  orderLabel: string;
  visible: boolean;
  onClose: () => void;
  onSave: (file: WmsPackingProofFile) => Promise<boolean>;
};

export function PackingProofModal({
  error,
  isUploading,
  orderLabel,
  visible,
  onClose,
  onSave,
}: PackingProofModalProps) {
  const [localError, setLocalError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<WmsPackingProofFile | null>(null);

  useEffect(() => {
    if (visible) {
      return;
    }

    setLocalError(null);
    setSelectedFile(null);
  }, [visible]);

  const openCamera = async () => {
    setLocalError(null);
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      setLocalError('Camera permission is required to take a packing photo.');
      return;
    }

    // Use Android's camera activity instead of holding the rugged scanner imager
    // inside this React Native view. Closing the activity releases the imager
    // before the next waybill scan begins.
    const result = await ImagePicker.launchCameraAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.82,
    });
    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_INPUT_BYTES) {
      setLocalError('Packing proof must be 30MB or smaller.');
      return;
    }

    setSelectedFile({
      uri: asset.uri,
      name: asset.fileName || `packing-${orderLabel.replace(/[^a-z0-9]+/gi, '-')}-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      source: 'CAMERA',
      byteSize: asset.fileSize,
    });
  };

  const chooseFromGallery = async () => {
    setLocalError(null);
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setLocalError('Photo library permission is required to select a packing photo.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 0.85,
      selectionLimit: 1,
    });
    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];
    if (!asset) {
      return;
    }
    if (asset.fileSize && asset.fileSize > MAX_INPUT_BYTES) {
      setLocalError('Packing proof must be 30MB or smaller.');
      return;
    }

    setSelectedFile({
      uri: asset.uri,
      name: asset.fileName || `packing-${Date.now()}.jpg`,
      type: asset.mimeType || 'image/jpeg',
      source: 'FILE',
      byteSize: asset.fileSize,
    });
  };

  const saveProof = async () => {
    if (!selectedFile || isUploading) {
      return;
    }

    const saved = await onSave(selectedFile);
    if (saved) {
      onClose();
    }
  };

  return (
    <Modal
      animationType="slide"
      presentationStyle="fullScreen"
      visible={visible}
      onRequestClose={() => {
        if (!isUploading) {
          onClose();
        }
      }}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PACKING PROOF</Text>
            <Text style={styles.title}>{orderLabel}</Text>
          </View>
          <Pressable
            disabled={isUploading}
            onPress={onClose}
            style={styles.closeButton}>
            <Feather name="x" size={22} color={tokens.colors.ink} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          {selectedFile ? (
            <View style={styles.previewStage}>
              <Image contentFit="contain" source={{ uri: selectedFile.uri }} style={styles.previewImage} />
              <View style={styles.previewMetaRow}>
                <View style={styles.previewMetaCopy}>
                  <Text numberOfLines={1} style={styles.previewName}>{selectedFile.name}</Text>
                  <Text style={styles.previewSource}>
                    {selectedFile.source === 'CAMERA' ? 'Camera photo' : 'Selected photo'}
                  </Text>
                </View>
                <Pressable
                  disabled={isUploading}
                  onPress={() => setSelectedFile(null)}
                  style={styles.changeButton}>
                  <Text style={styles.changeButtonText}>Change</Text>
                </Pressable>
              </View>
            </View>
          ) : (
            <View style={styles.choiceStack}>
              <Text style={styles.instructions}>
                Photograph the verified items before bubble wrap, or select one clear image from the device.
              </Text>
              <Pressable onPress={() => void openCamera()} style={styles.captureChoice}>
                <View style={styles.choiceIconPrimary}>
                  <Feather name="camera" size={24} color="#FFFFFF" />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Take photo</Text>
                  <Text style={styles.choiceDescription}>Open the back camera</Text>
                </View>
                <Feather name="chevron-right" size={22} color={tokens.colors.inkMuted} />
              </Pressable>
              <Pressable onPress={() => void chooseFromGallery()} style={styles.galleryChoice}>
                <View style={styles.choiceIconSecondary}>
                  <Feather name="image" size={24} color={tokens.colors.panel} />
                </View>
                <View style={styles.choiceCopy}>
                  <Text style={styles.choiceTitle}>Choose from gallery</Text>
                  <Text style={styles.choiceDescription}>JPEG, PNG, or WebP up to 30MB</Text>
                </View>
                <Feather name="chevron-right" size={22} color={tokens.colors.inkMuted} />
              </Pressable>
            </View>
          )}

          {localError || error ? (
            <View style={styles.errorBanner}>
              <Feather name="alert-circle" size={18} color={tokens.colors.danger} />
              <Text style={styles.errorText}>{localError || error}</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          <PrimaryButton
            disabled={!selectedFile}
            label="Save packing proof"
            loading={isUploading}
            onPress={() => void saveProof()}
          />
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    backgroundColor: tokens.colors.background,
    flex: 1,
  },
  header: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderBottomColor: tokens.colors.border,
    borderBottomWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.md,
  },
  headerCopy: {
    flex: 1,
  },
  eyebrow: {
    color: tokens.colors.inkMuted,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 2,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 3,
  },
  closeButton: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: 22,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  content: {
    flexGrow: 1,
    padding: tokens.spacing.lg,
  },
  choiceStack: {
    gap: tokens.spacing.md,
  },
  instructions: {
    color: tokens.colors.inkMuted,
    fontSize: 16,
    lineHeight: 24,
    marginBottom: tokens.spacing.sm,
  },
  captureChoice: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.panel,
    borderRadius: tokens.radius.lg,
    borderWidth: 2,
    flexDirection: 'row',
    gap: tokens.spacing.md,
    minHeight: 92,
    padding: tokens.spacing.md,
  },
  galleryChoice: {
    alignItems: 'center',
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.md,
    minHeight: 92,
    padding: tokens.spacing.md,
  },
  choiceIconPrimary: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  choiceIconSecondary: {
    alignItems: 'center',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 26,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  choiceCopy: {
    flex: 1,
  },
  choiceTitle: {
    color: tokens.colors.ink,
    fontSize: 17,
    fontWeight: '800',
  },
  choiceDescription: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 4,
  },
  previewStage: {
    backgroundColor: tokens.colors.surface,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  previewImage: {
    aspectRatio: 4 / 3,
    backgroundColor: '#0A1821',
    width: '100%',
  },
  previewMetaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  previewMetaCopy: {
    flex: 1,
  },
  previewName: {
    color: tokens.colors.ink,
    fontSize: 15,
    fontWeight: '800',
  },
  previewSource: {
    color: tokens.colors.inkMuted,
    fontSize: 13,
    marginTop: 3,
  },
  changeButton: {
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.pill,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  changeButtonText: {
    color: tokens.colors.ink,
    fontSize: 14,
    fontWeight: '700',
  },
  errorBanner: {
    alignItems: 'flex-start',
    backgroundColor: '#FFF0EE',
    borderColor: '#F2B8B0',
    borderRadius: tokens.radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.md,
    padding: tokens.spacing.md,
  },
  errorText: {
    color: tokens.colors.danger,
    flex: 1,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
  },
  footer: {
    backgroundColor: tokens.colors.surface,
    borderTopColor: tokens.colors.border,
    borderTopWidth: 1,
    padding: tokens.spacing.lg,
  },
});
