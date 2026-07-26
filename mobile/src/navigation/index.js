import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { useCommunication } from '../context/CommunicationContext';
import { THEME, AME } from '../theme';
import ClientDrawerContent from '../components/client/ClientDrawerContent';
import { navigateToFreshHome } from './navigateToFreshHome';
import { navigate } from './navigationRef';

// Auth
import RoleSelectScreen from '../screens/RoleSelectScreen';
import LoginScreen      from '../screens/auth/LoginScreen';
import RegisterScreen   from '../screens/auth/RegisterScreen';

// Partagés
import ChatScreen          from '../screens/ChatScreen';
import ProfileScreen       from '../screens/ProfileScreen';

// Client Phase 2
import HomeScreen          from '../screens/client/HomeScreen';
import ProductDetailScreen from '../screens/client/ProductDetailScreen';
import OrderConfirmScreen  from '../screens/client/OrderConfirmScreen';
import OrderTrackingScreen from '../screens/client/OrderTrackingScreen';
import StoreDetailScreen   from '../screens/client/StoreDetailScreen';
import CartScreen          from '../screens/client/CartScreen';
import OrderHistoryScreen  from '../screens/client/OrderHistoryScreen';
import MesCommercesScreen  from '../screens/client/MesCommercesScreen';
import ClientInfoScreen    from '../screens/client/ClientInfoScreen';
import HelpCenterScreen    from '../screens/client/HelpCenterScreen';
import SupportChatScreen   from '../screens/client/SupportChatScreen';
import ClientProfileHubScreen from '../screens/client/ClientProfileHubScreen';
import FavoriteStoresScreen from '../screens/client/FavoriteStoresScreen';
import ClientMessagingHomeScreen from '../screens/client/ClientMessagingHomeScreen';
import FaqScreen from '../screens/client/FaqScreen';
import BecomeDriverScreen from '../screens/client/BecomeDriverScreen';
import ContactScreen from '../screens/client/ContactScreen';
import SettingsScreen from '../screens/client/SettingsScreen';
import WalletScreen from '../screens/client/WalletScreen';
import WalletFamilyScreen from '../screens/client/WalletFamilyScreen';
import WalletObjectDetailScreen from '../screens/client/WalletObjectDetailScreen';
import IdentityScreen from '../screens/client/IdentityScreen';

// Deuxième Âme — seconde face de Ma Zone (vie de quartier)
import DeuxiemeAmeHomeScreen from '../screens/deuxiemeAme/DeuxiemeAmeHomeScreen';
import EventsScreen from '../screens/deuxiemeAme/EventsScreen';
import EventDetailScreen from '../screens/deuxiemeAme/EventDetailScreen';
import LanternsScreen from '../screens/deuxiemeAme/LanternsScreen';
import LanternScanScreen from '../screens/deuxiemeAme/LanternScanScreen';
import ParticiperScreen from '../screens/deuxiemeAme/ParticiperScreen';
import DecouvrirQuartierScreen from '../screens/deuxiemeAme/DecouvrirQuartierScreen';
import MesAdressesScreen from '../screens/deuxiemeAme/MesAdressesScreen';
import SurpriseScreen from '../screens/deuxiemeAme/SurpriseScreen';
import MurmursScreen from '../screens/deuxiemeAme/MurmursScreen';
import ModeReceptionScreen from '../screens/deuxiemeAme/ModeReceptionScreen';
import MailboxScreen from '../screens/deuxiemeAme/MailboxScreen';
import OpportunityInterestScreen from '../screens/deuxiemeAme/OpportunityInterestScreen';
import OpportunityBanner from '../components/deuxiemeAme/OpportunityBanner';
import SoulErrorBoundary from '../components/deuxiemeAme/SoulErrorBoundary';
import SoulSwitchFab from '../components/common/SoulSwitchFab';

// Merchant — Épée (poste de travail)
import MerchantCockpitScreen from '../screens/merchant/MerchantCockpitScreen';
import MerchantStatsScreen    from '../screens/merchant/MerchantStatsScreen';
import CreateStoreScreen    from '../screens/merchant/CreateStoreScreen';
import AddProductScreen     from '../screens/merchant/AddProductScreen';
import ManageStockScreen    from '../screens/merchant/ManageStockScreen';
import MerchantOrdersScreen from '../screens/merchant/MerchantOrdersScreen';
import ManagePromotionsScreen from '../screens/merchant/ManagePromotionsScreen';
import CreatePromotionScreen  from '../screens/merchant/CreatePromotionScreen';
import PromotionDetailScreen  from '../screens/merchant/PromotionDetailScreen';
import MerchantEventsScreen   from '../screens/merchant/MerchantEventsScreen';
import CreateEventScreen      from '../screens/merchant/CreateEventScreen';
import DiffuseOpportunityScreen from '../screens/merchant/DiffuseOpportunityScreen';
import MerchantInboxScreen    from '../screens/merchant/MerchantInboxScreen';
import MesClientsScreen         from '../screens/merchant/MesClientsScreen';
import MesIntegrationsScreen    from '../screens/merchant/MesIntegrationsScreen';
import MerchantSupportChatScreen from '../screens/merchant/MerchantSupportChatScreen';
import MerchantDrawerContent from '../components/merchant/MerchantDrawerContent';

// Driver — rework premium
import DriverHomeScreen     from '../screens/driver/DriverHomeScreen';
import DriverEarningsScreen from '../screens/driver/DriverEarningsScreen';
import DriverInboxScreen    from '../screens/driver/DriverInboxScreen';
import DriverMenuScreen     from '../screens/driver/DriverMenuScreen';
import DriverInfoScreen     from '../screens/driver/DriverInfoScreen';
import DriverHelpScreen     from '../screens/driver/DriverHelpScreen';
import DriverSettingsScreen from '../screens/driver/DriverSettingsScreen';
import DriverSupportChatScreen from '../screens/driver/DriverSupportChatScreen';

const Stack = createNativeStackNavigator();
const Tab   = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: THEME.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
  headerShadowVisible: false,
  animation: 'slide_from_right',
};

function TabIcon({ name, focused, badge, accent, muted }) {
  const active = accent || THEME.colors.accent;
  const idle = muted || THEME.colors.textMuted;
  return (
    <View>
      <Ionicons name={name} size={24} color={focused ? active : idle} />
      {badge > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

function AmeTabIcon({ name, focused, badge }) {
  return (
    <View style={{ alignItems: 'center' }}>
      <Ionicons
        name={name}
        size={focused ? 25 : 23}
        color={focused ? AME.colors.accentDeep : AME.colors.textMuted}
      />
      {focused ? <View style={styles.ameActiveDot} /> : <View style={styles.ameActiveDotSpacer} />}
      {badge > 0 && (
        <View style={[styles.badge, styles.ameBadge]}>
          <Text style={styles.badgeText}>{badge > 9 ? '9+' : badge}</Text>
        </View>
      )}
    </View>
  );
}

const tabOptions = {
  headerShown: false,
  tabBarActiveTintColor: THEME.colors.accent,
  tabBarInactiveTintColor: THEME.colors.textMuted,
  tabBarStyle: {
    height: 64, paddingBottom: 10, paddingTop: 8,
    backgroundColor: THEME.colors.card,
    borderTopColor: THEME.colors.borderLight,
    borderTopWidth: 1,
    ...THEME.shadow.md,
  },
  tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
};

/** Tab bar Deuxième Âme — terracotta doux, fond crème. */
const ameTabOptions = {
  headerShown: false,
  tabBarActiveTintColor: AME.colors.accentDeep,
  tabBarInactiveTintColor: AME.colors.textMuted,
  tabBarStyle: {
    height: 68,
    paddingBottom: 10,
    paddingTop: 8,
    backgroundColor: AME.colors.bgElevated,
    borderTopColor: AME.colors.borderLight,
    borderTopWidth: 1,
    ...AME.shadow.sm,
  },
  tabBarLabelStyle: {
    fontSize: 11,
    fontFamily: AME.fonts.uiSemiBold,
    fontWeight: '600',
  },
};

const ameScreenOptions = {
  headerStyle: { backgroundColor: AME.colors.bg },
  headerTintColor: AME.colors.text,
  headerTitleStyle: {
    fontFamily: AME.fonts.display,
    fontWeight: '600',
    fontSize: 20,
    color: AME.colors.text,
  },
  headerShadowVisible: false,
  contentStyle: { backgroundColor: AME.colors.bg },
  animation: 'slide_from_right',
  animationDuration: 320,
};

const clientDrawerHeader = (title) => ({
  headerShown: true,
  title,
  headerStyle: { backgroundColor: THEME.colors.primary },
  headerTintColor: '#fff',
  headerTitleStyle: { fontWeight: '700' },
});

// ── Client stacks ─────────────────────────────────────────────────────────────
function HomeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Home" component={HomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ title: 'Commerce' }} />
      <Stack.Screen name="OrderConfirm" component={OrderConfirmScreen} options={{ title: 'Confirmer' }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Suivi' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function CartStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Cart" component={CartScreen} options={{ title: 'Mon panier' }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Suivi' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function WalletStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="WalletHome" component={WalletScreen} options={{ headerShown: false }} />
      <Stack.Screen
        name="WalletFamily"
        component={WalletFamilyScreen}
        options={({ route }) => ({ title: route.params?.family?.label || 'Objets' })}
      />
      <Stack.Screen
        name="WalletObjectDetail"
        component={WalletObjectDetailScreen}
        options={({ route }) => ({ title: route.params?.title || 'Objet numérique' })}
      />
    </Stack.Navigator>
  );
}

function ProfileHubStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ClientProfileHub" component={ClientProfileHubScreen} options={{ title: 'Mon profil' }} />
      <Stack.Screen name="ClientInfo" component={ClientInfoScreen} options={{ title: 'Vos informations' }} />
    </Stack.Navigator>
  );
}

function MessagingStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="ClientMessagingHome" component={ClientMessagingHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MesCommerces" component={MesCommercesScreen} options={{ title: 'Mes commerces' }} />
      <Stack.Screen name="SupportChat" component={SupportChatScreen} options={{ title: 'Support client' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function OrderHistoryStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="OrderHistoryList" component={OrderHistoryScreen} options={{ headerShown: false }} />
      <Stack.Screen name="OrderTracking" component={OrderTrackingScreen} options={{ title: 'Suivi' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function HomeDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <ClientDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: 'rgba(15, 23, 42, 0.45)',
        drawerStyle: { width: '84%' },
        drawerItemStyle: { display: 'none' },
      }}
    >
      <Drawer.Screen name="HomeMain" component={HomeStack} />
      <Drawer.Screen
        name="ProfileHub"
        component={ProfileHubStack}
        options={{ headerShown: false }}
      />
      <Drawer.Screen
        name="FavoriteStores"
        component={FavoriteStoresScreen}
        options={clientDrawerHeader('Mes commerces coups de cœur')}
      />
      <Drawer.Screen
        name="OrderHistory"
        component={OrderHistoryStack}
        options={clientDrawerHeader('Mes commandes')}
      />
      <Drawer.Screen
        name="Faq"
        component={FaqScreen}
        options={clientDrawerHeader('FAQ')}
      />
      <Drawer.Screen
        name="BecomeDriver"
        component={BecomeDriverScreen}
        options={clientDrawerHeader('Devenir livreur')}
      />
      <Drawer.Screen
        name="Contact"
        component={ContactScreen}
        options={clientDrawerHeader('Contact')}
      />
      <Drawer.Screen
        name="HelpCenter"
        component={HelpCenterScreen}
        options={clientDrawerHeader('Aide')}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={clientDrawerHeader('Paramètres')}
      />
    </Drawer.Navigator>
  );
}

function ClientTabs() {
  const { count } = useCart();
  const { getTotalUnreadMessagingTab } = useCommunication();
  const messagingUnread = getTotalUnreadMessagingTab();

  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="HomeTab"
        component={HomeDrawer}
        options={{
          title: 'Home',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
        listeners={({ navigation }) => ({
          tabPress: (e) => {
            e.preventDefault();
            navigateToFreshHome(navigation);
          },
        })}
      />
      <Tab.Screen
        name="MessagingTab"
        component={MessagingStack}
        options={{
          title: 'Messagerie',
          tabBarIcon: ({ focused }) => (
            <TabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} badge={messagingUnread} />
          ),
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletStack}
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="CartTab"
        component={CartStack}
        options={{
          title: 'Panier',
          tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'cart' : 'cart-outline'} focused={focused} badge={count} />,
        }}
      />
    </Tab.Navigator>
  );
}

/**
 * Face Première Âme (Marketplace) : onglets inchangés + bouton de bascule d'Âme
 * en surimpression. Le bouton est le MÊME composant, à la MÊME position que sur
 * la Deuxième Âme : le changement d'Âme fonctionne identiquement dans les deux sens.
 */
function FirstSoulScreen() {
  return (
    <View style={{ flex: 1, backgroundColor: THEME.colors.bg }}>
      <ClientTabs />
      <SoulSwitchFab />
    </View>
  );
}

// Racine client : les DEUX faces coexistent comme écrans frères d'un même stack.
// On ne remplace JAMAIS l'arbre de navigation au basculement (sinon état périmé
// → écran blanc). switchSoul() met à jour activeSoul puis navigue vers FirstSoul
// ou SecondSoul. L'identité reste accessible depuis les deux faces.
function ClientRoot() {
  const { activeSoul } = useApp();
  return (
    <Stack.Navigator
      initialRouteName={activeSoul === 'second' ? 'SecondSoul' : 'FirstSoul'}
      screenOptions={{ headerShown: false }}
    >
      <Stack.Screen name="FirstSoul" component={FirstSoulScreen} />
      <Stack.Screen name="SecondSoul" component={SecondSoulScreen} />
      <Stack.Screen
        name="Identity"
        component={IdentityScreen}
        options={{ presentation: 'fullScreenModal', animation: 'slide_from_bottom' }}
      />
    </Stack.Navigator>
  );
}

// ── Deuxième Âme — seconde face de Ma Zone ─────────────────────────────────────
// L'Accueil compose les 6 portes sur les projections de l'Event Engine. Les
// onglets Messages / Wallet / Panier RÉUTILISENT les mêmes stacks que la Première
// Âme : panier, wallet et messagerie sont partagés entre les deux faces.
function DeuxiemeAmeHomeStack() {
  return (
    <Stack.Navigator screenOptions={ameScreenOptions}>
      <Stack.Screen name="DeuxiemeAmeHome" component={DeuxiemeAmeHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Events" component={EventsScreen} options={{ title: 'Les Événements' }} />
      <Stack.Screen name="EventDetail" component={EventDetailScreen} options={{ title: 'Initiative' }} />
      <Stack.Screen name="Lanterns" component={LanternsScreen} options={{ title: 'Les Lanternes' }} />
      <Stack.Screen name="LanternScan" component={LanternScanScreen} options={{ headerShown: false, presentation: 'fullScreenModal', animation: 'slide_from_bottom' }} />
      <Stack.Screen name="Participer" component={ParticiperScreen} options={{ title: 'Participer' }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Créer une initiative' }} />
      <Stack.Screen name="DecouvrirQuartier" component={DecouvrirQuartierScreen} options={{ title: 'Mon quartier' }} />
      <Stack.Screen name="MesAdresses" component={MesAdressesScreen} options={{ title: 'Mes adresses' }} />
      <Stack.Screen name="Surprise" component={SurpriseScreen} options={{ title: 'Se laisser surprendre' }} />
      <Stack.Screen name="Murmurs" component={MurmursScreen} options={{ title: 'Les murmures du quartier' }} />
      <Stack.Screen name="ModeReception" component={ModeReceptionScreen} options={{ title: 'Mode Réception' }} />
      <Stack.Screen name="Mailbox" component={MailboxScreen} options={{ title: 'Ma boîte aux lettres' }} />
      <Stack.Screen name="OpportunityInterest" component={OpportunityInterestScreen} options={{ title: 'Opportunité' }} />
      <Stack.Screen name="StoreDetail" component={StoreDetailScreen} options={{ title: 'Lieu' }} />
      <Stack.Screen name="ProductDetail" component={ProductDetailScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="ClientProfileHub" component={ClientProfileHubScreen} options={{ title: 'Mon profil' }} />
      <Stack.Screen name="ClientInfo" component={ClientInfoScreen} options={{ title: 'Vos informations' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function DeuxiemeAmeTabs() {
  const { count } = useCart();
  const { getTotalUnreadMessagingTab } = useCommunication();
  const messagingUnread = getTotalUnreadMessagingTab();

  return (
    <Tab.Navigator screenOptions={ameTabOptions}>
      <Tab.Screen
        name="AccueilTab"
        component={DeuxiemeAmeHomeStack}
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => <AmeTabIcon name={focused ? 'home' : 'home-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="MessagesTab"
        component={MessagingStack}
        options={{
          title: 'Messages',
          tabBarIcon: ({ focused }) => (
            <AmeTabIcon name={focused ? 'chatbubbles' : 'chatbubbles-outline'} focused={focused} badge={messagingUnread} />
          ),
        }}
      />
      <Tab.Screen
        name="WalletTab"
        component={WalletStack}
        options={{
          title: 'Wallet',
          tabBarIcon: ({ focused }) => <AmeTabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} />,
        }}
      />
      <Tab.Screen
        name="PanierTab"
        component={CartStack}
        options={{
          title: 'Panier',
          tabBarIcon: ({ focused }) => <AmeTabIcon name={focused ? 'cart' : 'cart-outline'} focused={focused} badge={count} />,
        }}
      />
    </Tab.Navigator>
  );
}

/** Face Deuxième Âme : onglets + bannière d'opportunité en surimpression. */
function SecondSoulScreen() {
  return (
    <SoulErrorBoundary>
      <View style={{ flex: 1, backgroundColor: AME.colors.bg }}>
        <View style={{ flex: 1 }}>
          <DeuxiemeAmeTabs />
        </View>
        <SoulSwitchFab />
        <OpportunityBanner
          onOpen={(payload) => {
            if (payload?.inboxId) {
              navigate('AccueilTab', {
                screen: 'OpportunityInterest',
                params: {
                  inboxId: payload.inboxId,
                  preview: {
                    id: payload.inboxId,
                    distanceKm: payload.distanceKm,
                    channels: payload.channels,
                    status: 'received',
                    event: payload.event,
                  },
                },
              });
            } else if (payload?.event?.id) {
              navigate('AccueilTab', { screen: 'EventDetail', params: { eventId: payload.event.id } });
            }
          }}
        />
      </View>
    </SoulErrorBoundary>
  );
}

// ── Merchant — Épée (Shell : Cockpit + registre de modules) ────────────────────
// Un seul stack contient tous les écrans d'organes du commerçant ; le Cockpit en
// est l'accueil. Le menu latéral (drawer) navigue vers ces écrans via le registre.
function EpeeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Cockpit" component={MerchantCockpitScreen} options={{ headerShown: false }} />
      <Stack.Screen name="CreateStore" component={CreateStoreScreen} options={{ title: 'Mon commerce' }} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="ManageStock" component={ManageStockScreen} options={{ title: 'Catalogue & stock' }} />
      <Stack.Screen name="ManagePromotions" component={ManagePromotionsScreen} options={{ title: 'Promotions' }} />
      <Stack.Screen name="CreatePromotion" component={CreatePromotionScreen} options={{ title: 'Nouvelle promotion' }} />
      <Stack.Screen name="PromotionDetail" component={PromotionDetailScreen} options={{ title: 'Détail promotion' }} />
      <Stack.Screen name="MerchantEvents" component={MerchantEventsScreen} options={{ title: 'Événements' }} />
      <Stack.Screen name="CreateEvent" component={CreateEventScreen} options={{ title: 'Nouvelle initiative' }} />
      <Stack.Screen name="DiffuseOpportunity" component={DiffuseOpportunityScreen} options={{ title: 'Opportunité Volante' }} />
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} options={{ title: 'Commandes reçues' }} />
      <Stack.Screen name="MesClients" component={MesClientsScreen} options={{ title: 'Mes clients' }} />
      <Stack.Screen name="MerchantInbox" component={MerchantInboxScreen} options={{ title: 'Messages' }} />
      <Stack.Screen name="MerchantSupportChat" component={MerchantSupportChatScreen} options={{ title: 'Assistance Ma Zone' }} />
      <Stack.Screen name="MerchantStats" component={MerchantStatsScreen} options={{ title: 'Statistiques' }} />
      <Stack.Screen name="MesIntegrations" component={MesIntegrationsScreen} options={{ title: 'Mes logiciels' }} />
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon profil' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function MerchantRoot() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <MerchantDrawerContent {...props} />}
      screenOptions={{
        headerShown: false,
        drawerType: 'front',
        overlayColor: THEME.colors.overlay,
        drawerStyle: { width: '86%' },
        drawerItemStyle: { display: 'none' },
      }}
    >
      <Drawer.Screen name="EpeeMain" component={EpeeStack} />
    </Drawer.Navigator>
  );
}

// ── Driver ────────────────────────────────────────────────────────────────────
function DriverHomeStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DriverHome" component={DriverHomeScreen} options={{ headerShown: false }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function DriverInboxStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DriverInbox" component={DriverInboxScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverSupportChat" component={DriverSupportChatScreen} options={{ title: 'Assistance Ma Zone' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function DriverMenuStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="DriverMenu" component={DriverMenuScreen} options={{ headerShown: false }} />
      <Stack.Screen name="DriverInfo" component={DriverInfoScreen} options={{ title: 'Mes informations' }} />
      <Stack.Screen name="DriverHelp" component={DriverHelpScreen} options={{ title: 'Aide' }} />
      <Stack.Screen name="DriverSettings" component={DriverSettingsScreen} options={{ title: 'Paramètres' }} />
      <Stack.Screen name="DriverSupportChat" component={DriverSupportChatScreen} options={{ title: 'Assistance Ma Zone' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function DriverTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen
        name="HomeTab"
        component={DriverHomeStack}
        options={{ title: 'Accueil', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'home' : 'home-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="Revenu"
        component={DriverEarningsScreen}
        options={{ title: 'Revenu', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'wallet' : 'wallet-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="InboxTab"
        component={DriverInboxStack}
        options={{ title: 'Boîte de réception', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'mail' : 'mail-outline'} focused={focused} /> }}
      />
      <Tab.Screen
        name="MenuTab"
        component={DriverMenuStack}
        options={{ title: 'Menu', tabBarIcon: ({ focused }) => <TabIcon name="menu" focused={focused} /> }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { user } = useApp();

  if (!user) {
    return (
      <Stack.Navigator screenOptions={screenOptions}>
        <Stack.Screen name="RoleSelect" component={RoleSelectScreen} options={{ title: 'Ma Zone', headerShown: false }} />
        <Stack.Screen name="Login" component={LoginScreen} options={{ title: 'Connexion' }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ title: 'Inscription' }} />
      </Stack.Navigator>
    );
  }

  // Client : une seule racine stable (FirstSoul + SecondSoul). La Première Âme
  // (FirstSoul → ClientTabs) reste inchangée ; la Deuxième Âme s'y ajoute.
  if (user.role === 'client') return <ClientRoot />;
  if (user.role === 'merchant') return <MerchantRoot />;
  return <DriverTabs />;
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: THEME.colors.error, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  ameBadge: {
    backgroundColor: AME.colors.error,
    top: -2,
    right: -10,
  },
  ameActiveDot: {
    width: 14,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: AME.colors.accent,
    marginTop: 3,
  },
  ameActiveDotSpacer: {
    height: 5.5,
  },
});
