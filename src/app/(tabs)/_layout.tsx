import { Redirect } from 'expo-router';
import { NativeTabs } from 'expo-router/native-tabs';

import { C } from '@/components/ui';
import { useFinance } from '@/data/finance-context';

export default function TabsLayout() {
  const { repo } = useFinance();
  if (!repo) return <Redirect href="/connexion" />;
  const home = require('@/assets/images/tabIcons/home.png');
  const explore = require('@/assets/images/tabIcons/explore.png');
  return (
    <NativeTabs backgroundColor={C.carte} indicatorColor={C.mentheClair} labelStyle={{ selected: { color: C.texte } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Aujourd’hui</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={home} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="calendrier">
        <NativeTabs.Trigger.Label>Calendrier</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={explore} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="dettes">
        <NativeTabs.Trigger.Label>Dettes</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={explore} renderingMode="template" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="epargne">
        <NativeTabs.Trigger.Label>Épargne</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon src={explore} renderingMode="template" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
