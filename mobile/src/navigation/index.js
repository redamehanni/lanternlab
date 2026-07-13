import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { useApp } from '../context/AppContext';
import { useCart } from '../context/CartContext';
import { useCommunication } from '../context/CommunicationContext';
import { THEME } from '../theme';
import ClientDrawerContent from '../components/client/ClientDrawerContent';
import { navigateToFreshHome } from './navigateToFreshHome';

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

// Merchant
import DashboardScreen      from '../screens/merchant/DashboardScreen';
import CreateStoreScreen    from '../screens/merchant/CreateStoreScreen';
import AddProductScreen     from '../screens/merchant/AddProductScreen';
import ManageStockScreen    from '../screens/merchant/ManageStockScreen';
import MerchantOrdersScreen from '../screens/merchant/MerchantOrdersScreen';
import ManagePromotionsScreen from '../screens/merchant/ManagePromotionsScreen';
import CreatePromotionScreen  from '../screens/merchant/CreatePromotionScreen';
import PromotionDetailScreen  from '../screens/merchant/PromotionDetailScreen';
import MerchantInboxScreen    from '../screens/merchant/MerchantInboxScreen';
import MesClientsScreen         from '../screens/merchant/MesClientsScreen';
import MerchantSupportChatScreen from '../screens/merchant/MerchantSupportChatScreen';

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

function TabIcon({ name, focused, badge }) {
  return (
    <View>
      <Ionicons name={name} size={24} color={focused ? THEME.colors.accent : THEME.colors.textMuted} />
      {badge > 0 && (
        <View style={styles.badge}>
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
        component={OrderHistoryScreen}
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

// ── Merchant ──────────────────────────────────────────────────────────────────
function MerchantDashStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Mon Commerce' }} />
      <Stack.Screen name="CreateStore" component={CreateStoreScreen} options={{ title: 'Ma boutique' }} />
      <Stack.Screen name="AddProduct" component={AddProductScreen} options={{ title: 'Produit' }} />
      <Stack.Screen name="ManageStock" component={ManageStockScreen} options={{ title: 'Gérer les stocks' }} />
      <Stack.Screen name="ManagePromotions" component={ManagePromotionsScreen} options={{ title: 'Promotions' }} />
      <Stack.Screen name="CreatePromotion" component={CreatePromotionScreen} options={{ title: 'Nouvelle promotion' }} />
      <Stack.Screen name="PromotionDetail" component={PromotionDetailScreen} options={{ title: 'Détail promotion' }} />
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} options={{ title: 'Commandes reçues' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function MerchantOrdersStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MerchantOrders" component={MerchantOrdersScreen} options={{ title: 'Commandes reçues' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function MerchantInboxStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="MerchantInbox" component={MerchantInboxScreen} options={{ headerShown: false }} />
      <Stack.Screen name="MesClients" component={MesClientsScreen} options={{ title: 'Mes clients' }} />
      <Stack.Screen name="MerchantSupportChat" component={MerchantSupportChatScreen} options={{ title: 'Assistance Ma Zone' }} />
      <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Messages' }} />
    </Stack.Navigator>
  );
}

function MerchantProfileStack() {
  return (
    <Stack.Navigator screenOptions={screenOptions}>
      <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'Mon profil' }} />
    </Stack.Navigator>
  );
}

function MerchantTabs() {
  return (
    <Tab.Navigator screenOptions={tabOptions}>
      <Tab.Screen name="DashTab" component={MerchantDashStack} options={{ title: 'Boutique', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'storefront' : 'storefront-outline'} focused={focused} /> }} />
      <Tab.Screen name="OrdersTab" component={MerchantOrdersStack} options={{ title: 'Commandes', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'receipt' : 'receipt-outline'} focused={focused} /> }} />
      <Tab.Screen name="InboxTab" component={MerchantInboxStack} options={{ title: 'Boîte de réception', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'mail' : 'mail-outline'} focused={focused} /> }} />
      <Tab.Screen name="ProfileTab" component={MerchantProfileStack} options={{ title: 'Profil', tabBarIcon: ({ focused }) => <TabIcon name={focused ? 'person' : 'person-outline'} focused={focused} /> }} />
    </Tab.Navigator>
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

  if (user.role === 'client') return <ClientTabs />;
  if (user.role === 'merchant') return <MerchantTabs />;
  return <DriverTabs />;
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute', top: -4, right: -8,
    backgroundColor: THEME.colors.error, borderRadius: 10,
    minWidth: 18, height: 18, alignItems: 'center', justifyContent: 'center',
  },
  badgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
});
