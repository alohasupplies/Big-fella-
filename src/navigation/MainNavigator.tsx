import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';

import { colors } from '../theme/colors';
import { RootStackParamList, TabParamList } from '../types';

// Screens
import HomeScreen from '../screens/HomeScreen';
import LiftScreen from '../screens/LiftScreen';
import RunScreen from '../screens/RunScreen';
import ProgressScreen from '../screens/ProgressScreen';
import ProfileScreen from '../screens/ProfileScreen';
import LogWorkoutScreen from '../screens/LogWorkoutScreen';
import LogRunScreen from '../screens/LogRunScreen';
import ExerciseDetailScreen from '../screens/ExerciseDetailScreen';
import WorkoutDetailScreen from '../screens/WorkoutDetailScreen';
import RunDetailScreen from '../screens/RunDetailScreen';
import ExerciseSearchScreen from '../screens/ExerciseSearchScreen';
import SettingsScreen from '../screens/SettingsScreen';
import DataExportScreen from '../screens/DataExportScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const getTabBarIcon = (routeName: string, focused: boolean, color: string, size: number) => {
  let iconName: keyof typeof Ionicons.glyphMap;

  switch (routeName) {
    case 'Home':
      iconName = focused ? 'home' : 'home-outline';
      break;
    case 'Lift':
      iconName = focused ? 'barbell' : 'barbell-outline';
      break;
    case 'Run':
      iconName = focused ? 'walk' : 'walk-outline';
      break;
    case 'Progress':
      iconName = focused ? 'analytics' : 'analytics-outline';
      break;
    case 'Profile':
      iconName = focused ? 'person' : 'person-outline';
      break;
    default:
      iconName = 'ellipse-outline';
  }

  return <Ionicons name={iconName} size={size} color={color} />;
};

const TabNavigator = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) =>
          getTabBarIcon(route.name, focused, color, size),
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: 5,
          paddingTop: 5,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      })}
    >
      <Tab.Screen
        name="Home"
        component={HomeScreen}
        options={{
          title: 'Dashboard',
          headerTitle: 'Big Fella Athletics',
        }}
      />
      <Tab.Screen
        name="Lift"
        component={LiftScreen}
        options={{
          title: 'Lift',
          headerTitle: 'Workouts',
        }}
      />
      <Tab.Screen
        name="Run"
        component={RunScreen}
        options={{
          title: 'Run',
          headerTitle: 'Running',
        }}
      />
      <Tab.Screen
        name="Progress"
        component={ProgressScreen}
        options={{
          title: 'Progress',
          headerTitle: 'Progress',
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          title: 'Profile',
          headerTitle: 'Profile',
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.surface,
        },
        headerTintColor: colors.textPrimary,
        headerTitleStyle: {
          fontWeight: 'bold',
        },
      }}
    >
      <Stack.Screen
        name="Main"
        component={TabNavigator}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="LogWorkout"
        component={LogWorkoutScreen}
        options={{
          title: 'Log Workout',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="LogRun"
        component={LogRunScreen}
        options={{
          title: 'Log Run',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="ExerciseDetail"
        component={ExerciseDetailScreen}
        options={{
          title: 'Exercise Details',
        }}
      />
      <Stack.Screen
        name="WorkoutDetail"
        component={WorkoutDetailScreen}
        options={{
          title: 'Workout Details',
        }}
      />
      <Stack.Screen
        name="RunDetail"
        component={RunDetailScreen}
        options={{
          title: 'Run Details',
        }}
      />
      <Stack.Screen
        name="ExerciseSearch"
        component={ExerciseSearchScreen}
        options={{
          title: 'Select Exercise',
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          title: 'Settings',
        }}
      />
      <Stack.Screen
        name="DataExport"
        component={DataExportScreen}
        options={{
          title: 'Export Data',
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;
