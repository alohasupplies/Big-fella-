import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius } from '../../theme/spacing';
import { Run } from '../../types';
import { getRunsForMonth } from '../../services/runService';

interface StreakCalendarProps {
  onDayPress?: (date: string, runs: Run[]) => void;
  currentStreak: number;
}

export const StreakCalendar: React.FC<StreakCalendarProps> = ({
  onDayPress,
  currentStreak,
}) => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth() + 1;

    console.log(`[StreakCalendar] Loading month: ${year}-${month}, currentDate=${currentDate.toISOString()}`);
    setLoading(true);
    getRunsForMonth(year, month).then((monthRuns) => {
      console.log(`[StreakCalendar] Got ${monthRuns.length} runs for ${year}-${month}, cancelled=${cancelled}`);
      if (!cancelled) {
        setRuns(monthRuns);
        setLoading(false);
      }
    }).catch((err) => {
      console.error(`[StreakCalendar] Error loading ${year}-${month}:`, err);
      if (!cancelled) {
        setLoading(false);
      }
    });

    return () => { cancelled = true; };
  }, [currentDate]);

  const getDaysInMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date): number => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const getRunsForDay = (day: number): Run[] => {
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return runs.filter((run) => run.date === dateStr);
  };

  const getDayColor = (day: number): string => {
    const dayRuns = getRunsForDay(day);
    if (dayRuns.length === 0) return colors.streakNone;

    const totalDistance = dayRuns.reduce((sum, run) => sum + run.distance, 0);

    // Color intensity based on distance
    if (totalDistance < 2) return colors.streakLight;
    if (totalDistance < 4) return colors.streakMedium;
    if (totalDistance < 6) return colors.streakStrong;
    return colors.streakIntense;
  };

  const goToPreviousMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const goToNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderDays = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const cells: { day: number | null }[] = [];

    // Add empty cells for days before the first of the month
    for (let i = 0; i < firstDay; i++) {
      cells.push({ day: null });
    }

    // Add cells for each day
    for (let day = 1; day <= daysInMonth; day++) {
      cells.push({ day });
    }

    // Pad remaining cells to complete the last row
    while (cells.length % 7 !== 0) {
      cells.push({ day: null });
    }

    const today = new Date();
    const isCurrentMonth =
      today.getFullYear() === currentDate.getFullYear() &&
      today.getMonth() === currentDate.getMonth();

    // Render rows of 7
    const rows: React.ReactNode[] = [];
    for (let i = 0; i < cells.length; i += 7) {
      const rowCells = cells.slice(i, i + 7).map((cell, idx) => {
        if (cell.day === null) {
          return <View key={`empty-${i + idx}`} style={styles.dayCell} />;
        }
        const day = cell.day;
        const isToday = isCurrentMonth && today.getDate() === day;
        const dayRuns = getRunsForDay(day);
        const hasRun = dayRuns.length > 0;

        return (
          <TouchableOpacity
            key={day}
            style={[
              styles.dayCell,
              { backgroundColor: getDayColor(day) },
              isToday && styles.todayCell,
            ]}
            onPress={() => {
              const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              onDayPress?.(dateStr, dayRuns);
            }}
          >
            <Text style={[styles.dayText, hasRun && styles.dayTextWithRun]}>
              {day}
            </Text>
            {hasRun && <View style={styles.runIndicator} />}
          </TouchableOpacity>
        );
      });
      rows.push(
        <View key={`row-${i}`} style={styles.row}>
          {rowCells}
        </View>
      );
    }

    return rows;
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <View style={styles.container}>
      {/* Streak Display */}
      <View style={styles.streakHeader}>
        <Ionicons name="flame" size={32} color={colors.primary} />
        <Text style={styles.streakNumber}>{currentStreak}</Text>
        <Text style={styles.streakLabel}>Day Streak</Text>
      </View>

      {/* Month Navigation */}
      <View style={styles.header}>
        <TouchableOpacity onPress={goToPreviousMonth} style={styles.navButton}>
          <Ionicons name="chevron-back" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
        <Text style={styles.monthText}>
          {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
        </Text>
        <TouchableOpacity onPress={goToNextMonth} style={styles.navButton}>
          <Ionicons name="chevron-forward" size={24} color={colors.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Day Headers */}
      <View style={styles.dayHeaders}>
        {dayNames.map((day) => (
          <Text key={day} style={styles.dayHeader}>
            {day}
          </Text>
        ))}
      </View>

      {/* Calendar Grid */}
      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      ) : (
        <View style={styles.grid}>{renderDays()}</View>
      )}

      {/* Legend */}
      <View style={styles.legend}>
        <Text style={styles.legendLabel}>Less</Text>
        <View style={[styles.legendBox, { backgroundColor: colors.streakNone }]} />
        <View style={[styles.legendBox, { backgroundColor: colors.streakLight }]} />
        <View style={[styles.legendBox, { backgroundColor: colors.streakMedium }]} />
        <View style={[styles.legendBox, { backgroundColor: colors.streakStrong }]} />
        <View style={[styles.legendBox, { backgroundColor: colors.streakIntense }]} />
        <Text style={styles.legendLabel}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: colors.surface,
    borderRadius: borderRadius.lg,
    padding: spacing.md,
  },
  streakHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  streakNumber: {
    fontSize: fontSize.hero,
    fontWeight: fontWeight.bold,
    color: colors.primary,
  },
  streakLabel: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  navButton: {
    padding: spacing.sm,
  },
  monthText: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.semibold,
    color: colors.textPrimary,
  },
  dayHeaders: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  dayHeader: {
    flex: 1,
    textAlign: 'center',
    fontSize: fontSize.xs,
    fontWeight: fontWeight.medium,
    color: colors.textSecondary,
  },
  loadingContainer: {
    height: 200,
    alignItems: 'center',
    justifyContent: 'center',
  },
  grid: {
  },
  row: {
    flexDirection: 'row',
  },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: borderRadius.sm,
    marginBottom: 2,
  },
  todayCell: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  dayText: {
    fontSize: fontSize.sm,
    color: colors.textPrimary,
  },
  dayTextWithRun: {
    fontWeight: fontWeight.bold,
  },
  runIndicator: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
    gap: spacing.xs,
  },
  legendLabel: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  legendBox: {
    width: 16,
    height: 16,
    borderRadius: borderRadius.sm,
  },
});
