import { Redirect } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { API_BASE_URL } from '@/src/shared/config/env';
import { useSession } from '@/src/features/auth/session-context';
import { canEnterStoxWorkspace } from '@/src/features/home/rbac';
import { PrimaryButton } from '@/src/shared/components/primary-button';
import { SurfaceCard } from '@/src/shared/components/surface-card';
import { TextField } from '@/src/shared/components/text-field';
import { tokens } from '@/src/shared/theme/tokens';

export default function LoginScreen() {
  const { session, bootstrap, isHydrating, isSubmitting, signIn, signOut } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isHydrating && session && bootstrap) {
    if (canEnterStoxWorkspace(bootstrap)) {
      return <Redirect href="/home" />;
    }

    return (
      <AccessBlockedScreen
        error={error}
        isSubmitting={isSubmitting}
        onSignOut={async () => {
          setError(null);
          await signOut();
        }}
      />
    );
  }

  const canSubmit = email.trim().length > 0 && password.trim().length > 0;

  return (
    <KeyboardAvoidingView
      style={styles.keyboard}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.root}>
          <View style={styles.topGlow} />
          <View style={styles.bottomGlow} />

          <ScrollView
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.content}>
            <View style={styles.brandBlock}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>STOX</Text>
              </View>
              <Text style={styles.title}>Warehouse execution</Text>
              <Text style={styles.subtitle}>Use your WMS Web account.</Text>
            </View>

            <SurfaceCard style={styles.formCard}>
              <Text style={styles.cardTitle}>Sign in</Text>

              <View style={styles.formFields}>
                <TextField
                  label="Email"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="wms@tenant.com"
                />
                <TextField
                  label="Password"
                  autoComplete="password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Enter your password"
                />
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}

              <PrimaryButton
                label="Continue"
                loading={isSubmitting}
                disabled={!canSubmit || isSubmitting}
                onPress={async () => {
                  setError(null);

                  try {
                    await signIn({
                      email: email.trim(),
                      password,
                    });
                  } catch (nextError) {
                    setError(nextError instanceof Error ? nextError.message : 'Unable to sign in.');
                  }
                }}
              />
            </SurfaceCard>

            <View style={styles.footer}>
              <View style={styles.metaPill}>
                <Text style={styles.metaPillText}>Private build</Text>
              </View>
              <Text style={styles.metaUrl} numberOfLines={1}>
                {API_BASE_URL}
              </Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

function AccessBlockedScreen({
  error,
  isSubmitting,
  onSignOut,
}: {
  error: string | null;
  isSubmitting: boolean;
  onSignOut: () => Promise<void>;
}) {
  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <View style={styles.root}>
        <View style={styles.topGlow} />
        <View style={styles.bottomGlow} />

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}>
          <View style={styles.brandBlock}>
            <View style={styles.brandBadge}>
              <Text style={styles.brandBadgeText}>STOX</Text>
            </View>
            <Text style={styles.title}>Access not ready</Text>
            <Text style={styles.subtitle}>Use a WMS Web account with mobile access.</Text>
          </View>

          <SurfaceCard style={styles.formCard}>
            <Text style={styles.cardTitle}>Mobile access</Text>
            <Text style={styles.accessCopy}>
              This account can sign in, but STOX could not load an active WMS workspace. Partner
              filtering now happens inside Stock, not during login.
            </Text>

            {error ? <Text style={styles.error}>{error}</Text> : null}

            <PrimaryButton
              label="Use another account"
              variant="secondary"
              disabled={isSubmitting}
              onPress={onSignOut}
            />
          </SurfaceCard>
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  keyboard: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: tokens.colors.background,
  },
  root: {
    flex: 1,
    position: 'relative',
  },
  topGlow: {
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: 260,
    height: 260,
    opacity: 0.52,
    position: 'absolute',
    right: -90,
    top: -110,
    width: 260,
  },
  bottomGlow: {
    backgroundColor: tokens.colors.backgroundMuted,
    borderRadius: 300,
    bottom: -80,
    height: 300,
    left: -120,
    opacity: 0.4,
    position: 'absolute',
    width: 300,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.xxl,
  },
  brandBlock: {
    gap: tokens.spacing.sm,
    marginBottom: tokens.spacing.xl,
  },
  brandBadge: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.panel,
    borderRadius: tokens.radius.pill,
    justifyContent: 'center',
    minHeight: 36,
    paddingHorizontal: tokens.spacing.md,
  },
  brandBadgeText: {
    color: tokens.colors.surface,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 2.2,
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 36,
    fontWeight: '800',
    letterSpacing: -1.2,
  },
  subtitle: {
    color: tokens.colors.inkMuted,
    fontSize: 15,
    fontWeight: '600',
  },
  formCard: {
    gap: tokens.spacing.lg,
  },
  cardTitle: {
    color: tokens.colors.ink,
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -0.4,
  },
  formFields: {
    gap: tokens.spacing.md,
  },
  accessCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '600',
    lineHeight: 21,
  },
  error: {
    color: tokens.colors.danger,
    fontSize: 14,
    lineHeight: 20,
  },
  footer: {
    gap: tokens.spacing.sm,
    marginTop: tokens.spacing.lg,
  },
  metaPill: {
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: tokens.radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  metaPillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: '700',
  },
  metaUrl: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    lineHeight: 18,
  },
});
