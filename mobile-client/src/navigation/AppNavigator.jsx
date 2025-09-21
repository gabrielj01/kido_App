// mobile-client/src/navigation/AppNavigator.jsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { useFocusEffect } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import  Ionicons  from '@expo/vector-icons/Ionicons';
import { useAuth } from '../hooks/useAuth.js';
import { colors } from '../theme/color';
import api from '../api/client';
import { on } from '../contexts/EventBus.js';

// Auth
import LoginScreen from '../screens/Auth/LoginScreen.jsx';
import SignupStep1 from '../screens/Auth/SignupStep1.jsx';
import SignupStep2 from '../screens/Auth/SignupStep2.jsx';
import SignupStep3 from '../screens/Auth/SignupStep3.jsx';
import Signup from '../screens/Auth/Signup.jsx';
import ParentStep2 from '../screens/Auth/Parent/ParentStep2.jsx';
import ParentStep3 from '../screens/Auth/Parent/ParentStep3.jsx';
import ParentStep4 from '../screens/Auth/Parent/ParentStep4.jsx';
import SitterStep2 from '../screens/Auth/Sitter/SitterStep2.jsx';
import SitterStep3 from '../screens/Auth/Sitter/SitterStep3.jsx';
import SitterStep4 from '../screens/Auth/Sitter/SitterStep4.jsx';

// Roles (home)
import HomeParent from '../screens/Parent/ParentHome.jsx';
import HomeSitter from '../screens/Babysitter/SitterHome.jsx';

// Profile stack
import ProfileScreen from '../screens/Profile/ProfileScreen.jsx';
import EditProfileScreen from '../screens/Profile/EditProfileScreen.jsx';

// Search (parent list)
import BabysitterSearchScreen from '../screens/Search/BabysitterSearchScreen.jsx';

// Detail & booking flow
import BabysitterDetailsScreen from '../screens/Babysitter/BabysitterDetailsScreen.jsx';
import BookingScreen from '../screens/Booking/BookingScreen.jsx';
import MyBookingScreen from "../screens/Booking/MyBookingScreen.jsx";
import SitterRequestsScreen from "../screens/Babysitter/SitterRequestsScreen.jsx";
import BabysitterReviewsScreen from '../screens/Babysitter/BabysitterReviews.jsx';
import PostReviewScreen from '../screens/Babysitter/PostReviewScreen.jsx';
import BookingDeTails from '../screens/Booking/BookingDetails.jsx';

const RootStack = createNativeStackNavigator();
const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

/** Sub-stack for Profile (used by both roles) */
function ProfileStack() {
  return (
    <Stack.Navigator>
      <Stack.Screen name="ProfileMain" component={ProfileScreen} options={{ title: 'My Profile' }} />
      <Stack.Screen name="EditProfile" component={EditProfileScreen} options={{ title: 'Edit Profile' }} />
    </Stack.Navigator>
  );
}

/** Bottom tabs for Parent role */
function ParentTabs() {
  const [pendingCount, setPendingCount] = React.useState(0);

  const loadPending = React.useCallback(async () => {
    try {
      const res = await api.get('/api/bookings', { params: { role: 'parent', status: 'pending' } });
      const payload = res.data;
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setPendingCount(list.length || 0);
    } catch (e) {
      // ignore badge errors
    }
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

/** Parent root: tabs + flow screens pushed over the tabs */
const ParentStackNav = createNativeStackNavigator();
function ParentStack() {
  return (
    <ParentStackNav.Navigator>
      <ParentStackNav.Screen name="ParentTabs" component={ParentTabs} options={{ headerShown: false }} />
      <ParentStackNav.Screen name="BabysitterDetails" component={BabysitterDetailsScreen} options={{ title: 'Babysitter' }} />
      <ParentStackNav.Screen name="Booking" component={BookingScreen} options={{ title: 'Booking' }} />
      <ParentStackNav.Screen name="BookingDetails" component={BookingDeTails} options={{ title: 'Booking Details' }} />
      <ParentStackNav.Screen name="BabysitterReviews" component={BabysitterReviewsScreen} options={{ title: 'Reviews', headerShown: false }}/>
      <ParentStackNav.Screen name="PostReview" component={PostReviewScreen} options={{ title: 'Write a review' }}/>
    </ParentStackNav.Navigator>
  );
}

/** Bottom tabs for Sitter role */
function SitterTabs() {
  const [pendingCount, setPendingCount] = React.useState(0);

  const loadPending = React.useCallback(async () => {
    try {
      const res = await api.get('/api/bookings', { params: { role: 'sitter', status: 'pending' } });
      const payload = res.data;
      const list = Array.isArray(payload) ? payload : (payload?.data || []);
      setPendingCount(list.length || 0);
    } catch (e) {
      // ignore badge errors
    }
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
            case 'Requests': iconName = focused ? 'calendar' : 'calendar-outline'; break;
            case 'Profile': iconName = focused ? 'person' : 'person-outline'; break;
          }
          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeSitter} />
      <Tab.Screen name="Search" component={() => null} />
      <Tab.Screen name="Requests" component={SitterRequestsScreen} options={{ tabBarBadge: badgeValue }}/>
      <Tab.Screen name="Profile" component={ProfileStack} />
    </Tab.Navigator>
  );
}

/** Sitter root: tabs + flow screens pushed over the tabs (so SitterHome can navigate to Reviews) */
const SitterStackNav = createNativeStackNavigator();
function SitterStack() {
  return (
    <SitterStackNav.Navigator>
      <SitterStackNav.Screen name="SitterTabs" component={SitterTabs} options={{ headerShown: false }} />
      <SitterStackNav.Screen name="BookingDetails" component={BookingDeTails} options={{ title: 'Booking Details' }} />
      <SitterStackNav.Screen name="BabysitterReviews" component={BabysitterReviewsScreen} options={{ title: 'Reviews', headerShown: false }}/>
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
            <RootStack.Screen name="Login" component={LoginScreen} />
            <RootStack.Screen name="SignupStep1" component={SignupStep1} />
            <RootStack.Screen name="SignupStep2" component={SignupStep2} />
            <RootStack.Screen name="ParentStep2" component={ParentStep2} />
            <RootStack.Screen name="ParentStep3" component={ParentStep3} />
            <RootStack.Screen name="ParentStep4" component={ParentStep4} />
            <RootStack.Screen name="SitterStep2" component={SitterStep2} />
            <RootStack.Screen name="SitterStep3" component={SitterStep3} />
            <RootStack.Screen name="SitterStep4" component={SitterStep4} />
            <RootStack.Screen name="SignupStep3" component={SignupStep3} />
            <RootStack.Screen name="Signup" component={Signup} />
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
