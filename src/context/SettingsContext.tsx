import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AppSettings } from '../types';
import { getAll, runQuery } from '../database/database';

interface SettingsContextType {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
  isLoading: boolean;
}

const defaultSettings: AppSettings = {
  weightUnit: 'lbs',
  distanceUnit: 'miles',
  streakMinDistance: 0,
  streakMinDuration: 0,
  streakGracePeriod: 2,
  runReminderEnabled: true,
  runReminderTime: '20:00',
  workoutReminderEnabled: false,
  darkMode: 'system',
  monthlyFreezes: 2,
  healthSyncEnabled: false,
  restTimerDefault: 90,
};

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const rows = await getAll<{ key: string; value: string }>('SELECT * FROM settings');

      const loadedSettings: Partial<AppSettings> = {};

      rows.forEach((row) => {
        const key = row.key as keyof AppSettings;
        const value = row.value;

        switch (key) {
          case 'weightUnit':
            loadedSettings.weightUnit = value as 'lbs' | 'kg';
            break;
          case 'distanceUnit':
            loadedSettings.distanceUnit = value as 'miles' | 'km';
            break;
          case 'streakMinDistance':
          case 'streakMinDuration':
          case 'streakGracePeriod':
          case 'monthlyFreezes':
            loadedSettings[key] = parseFloat(value);
            break;
          case 'runReminderEnabled':
          case 'workoutReminderEnabled':
            loadedSettings[key] = value === 'true';
            break;
          case 'runReminderTime':
            loadedSettings.runReminderTime = value;
            break;
          case 'darkMode':
            loadedSettings.darkMode = value as 'light' | 'dark' | 'system';
            break;
          case 'healthSyncEnabled':
            loadedSettings.healthSyncEnabled = value === 'true';
            break;
          case 'restTimerDefault':
            loadedSettings.restTimerDefault = parseFloat(value);
            break;
        }
      });

      setSettings({ ...defaultSettings, ...loadedSettings });
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const updateSetting = async <K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ): Promise<void> => {
    try {
      const stringValue = String(value);
      await runQuery(
        'INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)',
        [key, stringValue]
      );

      setSettings((prev) => ({
        ...prev,
        [key]: value,
      }));
    } catch (error) {
      console.error(`Failed to update setting ${key}:`, error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSetting, isLoading }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (!context) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
