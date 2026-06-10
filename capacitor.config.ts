import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cosmiccoalescence.app',
  appName: 'Big Bang',
  webDir: 'dist',
  plugins: {
    FirebaseAuthentication: {
      skipNativeAuth: true,
      providers: ['apple.com', 'google.com'],
      google: {
        iOSClientId: '277610981534-8i5codlmp5p04vtgmncukuugp7hiqo7c.apps.googleusercontent.com',
      },
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_notification',
      iconColor: '#4df0cc',
    },
  },
  ios: {
    // Path B: all plugins enabled for iOS monetization + notifications.
    // Verify AdMob/RevenueCat compile via SPM in Xcode (prior xcframework concern).
    includePlugins: [
      '@capacitor-firebase/authentication',
      '@capacitor/haptics',
      '@capacitor-community/admob',
      '@revenuecat/purchases-capacitor',
      '@capacitor/local-notifications',
    ],
  },
  // Capacitor 8 SPM: avoid a SwiftPM package identity collision for the
  // capawesome auth plugin on iOS. Requires @capacitor/cli >= 8.4.0.
  // https://github.com/capawesome-team/capacitor-firebase/issues/959
  experimental: {
    ios: {
      spm: {
        packageOptions: {
          '@capacitor-firebase/authentication': {
            symlink: true,
          },
        },
      },
    },
  },
};

export default config;
