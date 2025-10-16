import React from 'react';
import { NavigationContainer, useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useAuth } from '../hooks/useAuth.js';
import { colors } from '../theme/color';
import api from '../api/client';
import { on } from '../contexts/EventBus.js';

// Header logo (image only)
import AppHeaderLogo from '../components/AppHeaderLogo.jsx';

// Auth
import LoginScreen from '../screens/Auth/LoginScreen.jsx';
import SignupStep1 from '../screens/Auth/SignupStep1.jsx';
import SignupPhoto from '../screens/Auth/SignupPhoto.jsx';
import SignupStep2 from '../screens/Auth/SignupStep2.jsx';
import Signup from '../screens/Auth/Signup.jsx';
import ParentStep2 from '../screens/Auth/Parent/ParentStep2.jsx';
import ParentStep3 from '../screens/Auth/Parent/ParentStep3.jsx';
import ParentStep4 from '../screens/Auth/Parent/ParentStep4.jsx';
import SitterStep2 from '../screens/Auth/Sitter/SitterStep2.jsx';
import SitterStep3 from '../screens/Auth/Sitter/SitterStep3.jsx';
import SitterStep4 from '../screens/Auth/Sitter/SitterStep4.jsx';

// Home (roles)
import HomeParent from '../screens/Parent/ParentHome.jsx';
import HomeSitter from '../screens/Babysitter/SitterHome.jsx';

// Profile (stack)
import ProfileScreen from '../screens/Profile/ProfileScreen.jsx';
import EditProfileScreen from '../screens/Profile/EditProfileScreen.jsx';

// Search & booking
import BabysitterSearchScreen from '../screens/Search/BabysitterSearchScreen.jsx';
import BabysitterDetailsScreen from '../screens/Babysitter/BabysitterDetailsScreen.jsx';
import BookingScreen from '../screens/Booking/BookingScreen.jsx';
import MyBookingScreen from "../screens/Booking/MyBookingScreen.jsx";
import SitterRequestsScreen from "../screens/Babysitter/SitterRequestsScreen.jsx";
import BabysitterReviewsScreen from '../screens/Babysitter/BabysitterReviews.jsx';
import PostReviewScreen from '../screens/Babysitter/PostReviewScreen.jsx';
import BookingDetails from '../screens/Booking/BookingDetails.jsx';
import PayoutsScreen from '../screens/Babysitter/PayoutsScreen.jsx';

const RootStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

const authHeaderOptions = {
  headerShown: true,
  headerTransparent: true,
  headerTitle: () => <AppHeaderLogo />,
  headerTitleAlign: 'center',
  headerTitleContainerStyle: { width: 'auto' },
  headerStyle: { backgroundColor: 'transparent' },
  headerShadowVisible: false,
};

/** Profile stack */
function ProfileStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} />
    </Stack.Navigator>
  );
}

/** Parent tabs */
function ParentTabs() {
  const [pendingCount, setPendingCount] = React.useState(0);

  const loadPending = React.useCallback(async () => {
    try {
      const res = await api.get('/api/bookings', { params: { role: 'parent', status: 'pending' } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setPendingCount(data.length || 0);
    } catch {}
  }, []);

  useFocusEffect(React.useCallback(() => { loadPending(); }, [loadPending]));
  React.useEffect(() => on('bookings:changed', loadPending), [loadPending]);

  const badgeValue = pendingCount > 9 ? '9+' : (pendingCount || undefined);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors?.primary || '#FFB300',
        tabBarInactiveTintColor: colors?.textLight || '#90A4AE',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          switch (route.name) {
            case 'Home': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Search': iconName = focused ? 'search' : 'search-outline'; break;
            case 'Bookings': iconName = focused ? 'calendar' : 'calendar-outline'; break;
            case 'Profile': iconName = focused ? 'person' : 'person-outline'; break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeParent} />
      <Tab.Screen name="Search" component={BabysitterSearchScreen} />
      <Tab.Screen name="Bookings" component={MyBookingScreen} options={{ tabBarBadge: badgeValue }}/>
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

/** Parent root (keeps an app header with logo above tabs as before) */
const ParentStackNav = createNativeStackNavigator();
function ParentStack() {
  return (
    <ParentStackNav.Navigator
      screenOptions={{
        headerTitle: () => <AppHeaderLogo />,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#FFFFFF' },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <ParentStackNav.Screen name="ParentTabs" component={ParentTabs} />
      <ParentStackNav.Screen name="BabysitterDetails" component={BabysitterDetailsScreen} options={{ title: 'Babysitter' }} />
      <ParentStackNav.Screen name="Booking" component={BookingScreen} options={{ title: 'Booking' }} />
      <ParentStackNav.Screen name="BookingDetails" component={BookingDetails} options={{ title: 'Booking Details' }} />
      <ParentStackNav.Screen name="BabysitterReviews" component={BabysitterReviewsScreen} options={{ title: 'Reviews' }} />
      <ParentStackNav.Screen name="PostReview" component={PostReviewScreen} options={{ title: 'Write a review' }}/>
    </ParentStackNav.Navigator>
  );
}

/** Sitter tabs */
function SitterTabs() {
  const [pendingCount, setPendingCount] = React.useState(0);

  const loadPending = React.useCallback(async () => {
    try {
      const res = await api.get('/api/bookings', { params: { role: 'sitter', status: 'pending' } });
      const data = Array.isArray(res.data) ? res.data : (res.data?.data || []);
      setPendingCount(data.length || 0);
    } catch {}
  }, []);

  useFocusEffect(React.useCallback(() => { loadPending(); }, [loadPending]));
  React.useEffect(() => on('bookings:changed', loadPending), [loadPending]);

  const badgeValue = pendingCount > 9 ? '9+' : (pendingCount || undefined);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors?.primary || '#FFB300',
        tabBarInactiveTintColor: colors?.textLight || '#90A4AE',
        tabBarIcon: ({ focused, color, size }) => {
          let iconName = 'ellipse';
          switch (route.name) {
            case 'Home': iconName = focused ? 'home' : 'home-outline'; break;
            case 'Requests': iconName = focused ? 'calendar' : 'calendar-outline'; break;
            case 'Profile': iconName = focused ? 'person' : 'person-outline'; break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeSitter} />
      <Tab.Screen name="Requests" component={SitterRequestsScreen} options={{ tabBarBadge: badgeValue }}/>
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

/** Sitter root */
const SitterStackNav = createNativeStackNavigator();
function SitterStack() {
  return (
    <SitterStackNav.Navigator
      screenOptions={{
        headerTitle: () => <AppHeaderLogo />,
        headerTitleAlign: 'center',
        headerShadowVisible: false,
        headerStyle: { backgroundColor: '#FFFFFF' },
        contentStyle: { backgroundColor: '#FFFFFF' },
      }}
    >
      <SitterStackNav.Screen name="SitterTabs" component={SitterTabs} />
      <SitterStackNav.Screen name="BookingDetails" component={BookingDetails} options={{ title: 'Booking Details' }} />
      <SitterStackNav.Screen name="BabysitterReviews" component={BabysitterReviewsScreen} options={{ title: 'Reviews' }} />
      <SitterStackNav.Screen name="Payouts" component={PayoutsScreen} options={{ title: 'My Payouts' }}/>
      <SitterStackNav.Screen name="PostReview" component={PostReviewScreen} options={{ title: 'Write a review' }}/>
    </SitterStackNav.Navigator>
  );
}

/** Root */
export default function AppNavigator() {
  const { user, loading } = useAuth();
  if (loading) return null;

  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        {user == null ? (
          <>
            {/* Keep login minimal; no header */}
            <RootStack.Screen name="Login" component={LoginScreen} options={authHeaderOptions}/>
            {/* Signup flow: transparent header with image-only logo */}
            <RootStack.Screen name="SignupStep1" component={SignupStep1} options={authHeaderOptions} />
            <RootStack.Screen name="SignupPhoto" component={SignupPhoto} options={authHeaderOptions} />
            <RootStack.Screen name="SignupStep2" component={SignupStep2} options={authHeaderOptions} />
            <RootStack.Screen name="ParentStep2" component={ParentStep2} options={authHeaderOptions} />
            <RootStack.Screen name="ParentStep3" component={ParentStep3} options={authHeaderOptions} />
            <RootStack.Screen name="ParentStep4" component={ParentStep4} options={authHeaderOptions} />
            <RootStack.Screen name="SitterStep2" component={SitterStep2} options={authHeaderOptions} />
            <RootStack.Screen name="SitterStep3" component={SitterStep3} options={authHeaderOptions} />
            <RootStack.Screen name="SitterStep4" component={SitterStep4} options={authHeaderOptions} />
            <RootStack.Screen name="Signup" component={Signup} options={authHeaderOptions} />
          </>
        ) : user.role === 'parent' ? (
          <RootStack.Screen name="ParentRoot" component={ParentStack} />
        ) : (
          <RootStack.Screen name="SitterRoot" component={SitterStack} />
        )}
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
