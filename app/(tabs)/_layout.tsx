import { Tabs } from 'expo-router';
import React from 'react';

import { HapticTab } from '@/components/haptic-tab';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarButton: HapticTab,
        tabBarActiveTintColor:
          Colors[colorScheme ?? 'light'].tint,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Souviens-toi',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="mic.fill"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="rappelle-moi"
        options={{
          title: 'Rappelle-moi',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="magnifyingglass"
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="préviens-moi"
        options={{
          title: 'Préviens-moi',
          tabBarIcon: ({ color }) => (
            <IconSymbol
              size={28}
              name="bell.fill"
              color={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}