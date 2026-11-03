import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { AppText } from '@/components/ui/AppText';
import { Icon, IconName } from '@/components/ui/Icon';
import { PressableScale } from '@/components/ui/PressableScale';
import { APP_TAGLINE } from '@/lib/constants';
import { STUDENT_EMAIL_DOMAIN } from '@/lib/validation';
import { radius, spacing } from '@/theme/tokens';

const FEATURES: { icon: IconName; title: string; text: string }[] = [
  { icon: 'people', title: 'Meet your people', text: 'Find students on your course, in your halls and into the same things as you.' },
  { icon: 'calendar', title: 'Never miss a night', text: 'Socials, sports, study groups and parties, all in one place.' },
  { icon: 'chatbubbles', title: 'Join the conversation', text: 'Communities for every course, hobby and corner of campus.' },
  { icon: 'pricetags', title: 'Buy, sell & swap', text: 'A marketplace where everyone is a fellow Beckett student.' },
];

export default function Welcome() {
  const fade = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 600, useNativeDriver: true }).start();
  }, [fade]);

  return (
    <LinearGradient colors={['#1E0B45', '#4C1D95', '#86198F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.flex}>
      <SafeAreaView style={styles.flex} edges={['top', 'bottom']}>
        <Animated.View
          style={[
            styles.content,
            { opacity: fade, transform: [{ translateY: fade.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) }] },
          ]}
        >
          <Logo light size={40} />
          <AppText variant="display" style={styles.headline}>
            Leeds Beckett.{'\n'}All in one place.
          </AppText>
          <AppText variant="body" style={styles.tagline}>
            {APP_TAGLINE} The social network built only for Leeds Beckett students.
          </AppText>

          <View style={styles.features}>
            {FEATURES.map((f) => (
              <View key={f.title} style={styles.feature}>
                <View style={styles.featureIcon}>
                  <Icon name={f.icon} size={18} color="#FFFFFF" />
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" style={styles.white}>
                    {f.title}
                  </AppText>
                  <AppText variant="caption" style={styles.dim}>
                    {f.text}
                  </AppText>
                </View>
              </View>
            ))}
          </View>
        </Animated.View>

        <View style={styles.actions}>
          <PressableScale
            onPress={() => router.push('/sign-up')}
            style={[styles.cta, styles.ctaPrimary]}
            accessibilityRole="button"
            accessibilityLabel="Create your account"
          >
            <AppText variant="bodyStrong" style={styles.ctaPrimaryText}>
              Create your account
            </AppText>
          </PressableScale>
          <PressableScale
            onPress={() => router.push('/sign-in')}
            style={[styles.cta, styles.ctaSecondary]}
            accessibilityRole="button"
            accessibilityLabel="I already have an account"
          >
            <AppText variant="bodyStrong" style={styles.white}>
              I already have an account
            </AppText>
          </PressableScale>
          <AppText variant="caption" align="center" style={styles.dim}>
            Exclusively for @{STUDENT_EMAIL_DOMAIN} emails
          </AppText>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: spacing.xxl, paddingTop: spacing.xxxl },
  headline: { color: '#FFFFFF', marginTop: spacing.xxxl },
  tagline: { color: 'rgba(255,255,255,0.82)', marginTop: spacing.md },
  features: { marginTop: spacing.xxxl, gap: spacing.lg },
  feature: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  white: { color: '#FFFFFF' },
  dim: { color: 'rgba(255,255,255,0.7)' },
  actions: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.lg, gap: spacing.md },
  cta: { height: 54, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  ctaPrimary: { backgroundColor: '#FFFFFF' },
  ctaPrimaryText: { color: '#4C1D95' },
  ctaSecondary: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.4)' },
});
