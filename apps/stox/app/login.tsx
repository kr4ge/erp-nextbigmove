import { Redirect } from 'expo-router';
import { Feather } from '@expo/vector-icons';
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
            <View style={styles.loginShell}>
              <View style={styles.brandBlock}>
                <View style={styles.brandBadge}>
                  <Text style={styles.brandBadgeText}>STOX</Text>
                </View>
                <View style={styles.brandCopy}>
                  <Text style={styles.title}>Sign in</Text>
                  <Text style={styles.subtitle}>Use your WMS Web account.</Text>
                </View>
              </View>

              <View style={styles.privatePill}>
                <Feather name="shield" size={13} color={tokens.colors.ink} />
                <Text style={styles.privatePillText}>Private Android workspace</Text>
              </View>
            </View>

            <SurfaceCard style={styles.formCard}>
              <View style={styles.formFields}>
                <TextField
                  label="Email"
                  keyboardType="email-address"
                  autoComplete="email"
                  autoCorrect={false}
                  value={email}
                  onChangeText={setEmail}
                  placeholder="Email address"
                  style={styles.loginInput}
                />
                <TextField
                  label="Password"
                  autoComplete="password"
                  secureTextEntry
                  value={password}
                  onChangeText={setPassword}
                  placeholder="Password"
                  style={styles.loginInput}
                />
              </View>

              {error ? (
                <View style={styles.errorCard}>
                  <Feather name="alert-circle" size={16} color="#D35445" />
                  <Text style={styles.error}>{error}</Text>
                </View>
              ) : null}

              <PrimaryButton
                label="Sign in"
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

              <Text style={styles.formHint}>Pick, pack, inventory, and RTS access follows your WMS role.</Text>
            </SurfaceCard>
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
          <View style={styles.loginShell}>
            <View style={styles.brandBlock}>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>STOX</Text>
              </View>
              <View style={styles.brandCopy}>
                <Text style={styles.title}>Access not ready</Text>
                <Text style={styles.subtitle}>This account needs an active STOX workspace.</Text>
              </View>
            </View>
          </View>

          <SurfaceCard style={styles.formCard}>
            <View style={styles.blockedIcon}>
              <Feather name="shield-off" size={18} color={tokens.colors.danger} />
            </View>
            <Text style={styles.accessCopy}>
              This account can sign in, but STOX could not load a WMS workspace for mobile tasks.
            </Text>

            {error ? (
              <View style={styles.errorCard}>
                <Feather name="alert-circle" size={16} color="#D35445" />
                <Text style={styles.error}>{error}</Text>
              </View>
            ) : null}

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
    backgroundColor: 'rgba(240, 197, 82, 0.26)',
    borderRadius: 220,
    height: 190,
    opacity: 0.86,
    position: 'absolute',
    right: -74,
    top: -82,
    width: 190,
  },
  bottomGlow: {
    backgroundColor: 'rgba(18, 54, 79, 0.08)',
    borderRadius: 260,
    bottom: -96,
    height: 220,
    left: -108,
    opacity: 0.92,
    position: 'absolute',
    width: 220,
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: tokens.spacing.lg,
    paddingVertical: tokens.spacing.lg,
  },
  loginShell: {
    gap: tokens.spacing.md,
    marginBottom: tokens.spacing.lg,
  },
  brandBlock: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: tokens.spacing.md,
  },
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  brandBadge: {
    alignItems: 'center',
    backgroundColor: tokens.colors.panel,
    borderRadius: 20,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  brandBadgeText: {
    color: tokens.colors.surface,
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 1.8,
  },
  privatePill: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: tokens.colors.accentSoft,
    borderRadius: tokens.radius.pill,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 32,
    paddingHorizontal: tokens.spacing.md,
  },
  privatePillText: {
    color: tokens.colors.ink,
    fontSize: 12,
    fontWeight: '800',
  },
  title: {
    color: tokens.colors.ink,
    fontSize: 31,
    fontWeight: '900',
    letterSpacing: -0.9,
    lineHeight: 34,
  },
  subtitle: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 19,
    marginTop: 3,
  },
  formCard: {
    backgroundColor: tokens.colors.surface,
    borderColor: 'rgba(18, 54, 79, 0.08)',
    borderRadius: tokens.radius.xl,
    gap: tokens.spacing.md,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
    shadowColor: 'rgba(18, 54, 79, 0.14)',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 1,
    shadowRadius: 24,
  },
  formFields: {
    gap: 12,
  },
  loginInput: {
    backgroundColor: tokens.colors.surfaceMuted,
    borderColor: tokens.colors.border,
    borderRadius: tokens.radius.md,
    color: tokens.colors.ink,
    fontWeight: '800',
    minHeight: 52,
  },
  accessCopy: {
    color: tokens.colors.inkMuted,
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 21,
    textAlign: 'center',
  },
  blockedIcon: {
    alignItems: 'center',
    alignSelf: 'center',
    backgroundColor: 'rgba(211, 84, 69, 0.1)',
    borderRadius: tokens.radius.pill,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  errorCard: {
    alignItems: 'flex-start',
    backgroundColor: 'rgba(211, 84, 69, 0.1)',
    borderColor: 'rgba(211, 84, 69, 0.18)',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: tokens.spacing.sm,
    paddingHorizontal: tokens.spacing.md,
    paddingVertical: tokens.spacing.md,
  },
  error: {
    color: tokens.colors.danger,
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 20,
  },
  formHint: {
    color: tokens.colors.inkSoft,
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 17,
    textAlign: 'center',
  },
});
