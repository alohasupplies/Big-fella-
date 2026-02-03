import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../theme/colors';
import { spacing, fontSize, fontWeight, borderRadius, touchTarget } from '../theme/spacing';
import { Input } from '../components/common';
import { RootStackParamList, ExerciseLibraryItem, MuscleGroup, Equipment } from '../types';
import { getAll, getFavoriteExercises, addFavoriteExercise, removeFavoriteExercise, isFavoriteExercise } from '../database/database';

type RouteProps = RouteProp<RootStackParamList, 'ExerciseSearch'>;

const MUSCLE_GROUPS: { value: MuscleGroup; label: string }[] = [
  { value: 'chest', label: 'Chest' },
  { value: 'back', label: 'Back' },
  { value: 'shoulders', label: 'Shoulders' },
  { value: 'biceps', label: 'Biceps' },
  { value: 'triceps', label: 'Triceps' },
  { value: 'quadriceps', label: 'Quads' },
  { value: 'hamstrings', label: 'Hamstrings' },
  { value: 'glutes', label: 'Glutes' },
  { value: 'calves', label: 'Calves' },
  { value: 'core', label: 'Core' },
  { value: 'full_body', label: 'Full Body' },
];

const ExerciseSearchScreen: React.FC = () => {
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();

  const [searchQuery, setSearchQuery] = useState('');
  const [exercises, setExercises] = useState<ExerciseLibraryItem[]>([]);
  const [filteredExercises, setFilteredExercises] = useState<ExerciseLibraryItem[]>([]);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroup | null>(null);
  const [favorites, setFavorites] = useState<ExerciseLibraryItem[]>([]);
  const [favoriteIds, setFavoriteIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadExercises();
    loadFavorites();
  }, []);

  useEffect(() => {
    filterExercises();
  }, [searchQuery, selectedMuscle, exercises]);

  const loadExercises = async () => {
    try {
      const rows = await getAll<any>('SELECT * FROM exercise_library ORDER BY name');
      const mapped: ExerciseLibraryItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        alternativeNames: row.alternativeNames?.split(','),
        primaryMuscleGroup: row.primaryMuscleGroup as MuscleGroup,
        secondaryMuscleGroups: row.secondaryMuscleGroups?.split(',') as MuscleGroup[],
        equipment: row.equipment as Equipment,
        category: row.category,
        tags: row.tags?.split(','),
        videoUrl: row.videoUrl,
        isCustom: row.isCustom === 1,
      }));
      setExercises(mapped);
      setFilteredExercises(mapped);
    } catch (error) {
      console.error('Failed to load exercises:', error);
    }
  };

  const loadFavorites = async () => {
    try {
      const rows = await getFavoriteExercises();
      const mapped: ExerciseLibraryItem[] = rows.map((row) => ({
        id: row.id,
        name: row.name,
        alternativeNames: row.alternativeNames?.split(','),
        primaryMuscleGroup: row.primaryMuscleGroup as MuscleGroup,
        secondaryMuscleGroups: row.secondaryMuscleGroups?.split(',') as MuscleGroup[],
        equipment: row.equipment as Equipment,
        category: row.category,
        tags: row.tags?.split(','),
        videoUrl: row.videoUrl,
        isCustom: row.isCustom === 1,
      }));
      setFavorites(mapped);
      setFavoriteIds(new Set(mapped.map(e => e.id)));
    } catch (error) {
      console.error('Failed to load favorites:', error);
    }
  };

  const toggleFavorite = async (exerciseId: string) => {
    try {
      const isFav = favoriteIds.has(exerciseId);
      if (isFav) {
        await removeFavoriteExercise(exerciseId);
      } else {
        await addFavoriteExercise(exerciseId);
      }
      await loadFavorites();
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const filterExercises = () => {
    let filtered = exercises;

    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (e) =>
          e.name.toLowerCase().includes(query) ||
          e.alternativeNames?.some((name) => name.toLowerCase().includes(query)) ||
          e.primaryMuscleGroup.toLowerCase().includes(query)
      );
    }

    // Filter by muscle group
    if (selectedMuscle) {
      filtered = filtered.filter(
        (e) =>
          e.primaryMuscleGroup === selectedMuscle ||
          e.secondaryMuscleGroups?.includes(selectedMuscle)
      );
    }

    setFilteredExercises(filtered);
  };

  const handleSelect = (exercise: ExerciseLibraryItem) => {
    navigation.navigate('LogWorkout', { selectedExercise: exercise } as any);
  };

  const getMuscleGroupLabel = (muscleGroup: string): string => {
    return muscleGroup
      .split('_')
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const getEquipmentIcon = (equipment: Equipment): string => {
    switch (equipment) {
      case 'barbell':
        return 'barbell-outline';
      case 'dumbbell':
        return 'fitness-outline';
      case 'bodyweight':
        return 'body-outline';
      case 'cable':
        return 'git-branch-outline';
      case 'machine':
        return 'cog-outline';
      default:
        return 'ellipse-outline';
    }
  };

  const renderExercise = ({ item }: { item: ExerciseLibraryItem }) => {
    const isFav = favoriteIds.has(item.id);
    return (
      <View style={styles.exerciseItem}>
        <TouchableOpacity 
          style={styles.exerciseContent} 
          onPress={() => handleSelect(item)}
        >
          <View style={styles.exerciseIcon}>
            <Ionicons
              name={getEquipmentIcon(item.equipment) as any}
              size={24}
              color={colors.primary}
            />
          </View>
          <View style={styles.exerciseInfo}>
            <Text style={styles.exerciseName}>{item.name}</Text>
            <Text style={styles.exerciseMuscle}>
              {getMuscleGroupLabel(item.primaryMuscleGroup)}
              {item.secondaryMuscleGroups && item.secondaryMuscleGroups.length > 0 && (
                <Text style={styles.secondaryMuscles}>
                  {' '}+ {item.secondaryMuscleGroups.slice(0, 2).map(getMuscleGroupLabel).join(', ')}
                </Text>
              )}
            </Text>
          </View>
          <Ionicons name="add-circle" size={28} color={colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity 
          style={styles.favoriteButton}
          onPress={() => toggleFavorite(item.id)}
        >
          <Ionicons 
            name={isFav ? "star" : "star-outline"} 
            size={24} 
            color={isFav ? colors.primary : colors.textSecondary} 
          />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Search Input */}
      <View style={styles.searchContainer}>
        <Input
          containerStyle={styles.searchInput}
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search exercises..."
          leftIcon={<Ionicons name="search" size={20} color={colors.textSecondary} />}
        />
      </View>

      {/* Muscle Group Filter */}
      <View style={styles.filterContainer}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={MUSCLE_GROUPS}
          keyExtractor={(item) => item.value}
          contentContainerStyle={styles.filterList}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.filterChip,
                selectedMuscle === item.value && styles.filterChipActive,
              ]}
              onPress={() =>
                setSelectedMuscle(selectedMuscle === item.value ? null : item.value)
              }
            >
              <Text
                style={[
                  styles.filterChipText,
                  selectedMuscle === item.value && styles.filterChipTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Favorites Section */}
      {favorites.length > 0 && !searchQuery && !selectedMuscle && (
        <View style={styles.favoritesSection}>
          <Text style={styles.sectionTitle}>⭐ Favorites</Text>
          {favorites.map((item) => (
            <View key={item.id}>
              {renderExercise({ item })}
              <View style={styles.separator} />
            </View>
          ))}
        </View>
      )}

      {/* Results Count */}
      <Text style={styles.resultsCount}>
        {filteredExercises.length} exercises found
      </Text>

      {/* Exercise List */}
      <FlatList
        data={filteredExercises}
        keyExtractor={(item) => item.id}
        renderItem={renderExercise}
        contentContainerStyle={styles.list}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          <View style={styles.emptyState}>
            <Ionicons name="search-outline" size={48} color={colors.textDisabled} />
            <Text style={styles.emptyText}>No exercises found</Text>
            <Text style={styles.emptySubtext}>
              Try adjusting your search or filters
            </Text>
          </View>
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  searchContainer: {
    padding: spacing.md,
    paddingBottom: 0,
  },
  searchInput: {
    marginBottom: 0,
  },
  filterContainer: {
    paddingVertical: spacing.md,
  },
  filterList: {
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: borderRadius.full,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginRight: spacing.sm,
  },
  filterChipActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  filterChipText: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
  },
  filterChipTextActive: {
    color: colors.white,
    fontWeight: fontWeight.medium,
  },
  resultsCount: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    fontSize: fontSize.xs,
    color: colors.textSecondary,
  },
  list: {
    paddingHorizontal: spacing.md,
  },
  favoritesSection: {
    paddingHorizontal: spacing.md,
    marginBottom: spacing.md,
  },
  sectionTitle: {
    fontSize: fontSize.lg,
    fontWeight: fontWeight.bold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  exerciseItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    minHeight: touchTarget.min,
  },
  exerciseContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  favoriteButton: {
    padding: spacing.sm,
    marginLeft: spacing.sm,
  },
  exerciseIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  exerciseInfo: {
    flex: 1,
  },
  exerciseName: {
    fontSize: fontSize.md,
    fontWeight: fontWeight.medium,
    color: colors.textPrimary,
  },
  exerciseMuscle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
  },
  secondaryMuscles: {
    color: colors.textDisabled,
  },
  separator: {
    height: 1,
    backgroundColor: colors.border,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    fontSize: fontSize.lg,
    color: colors.textSecondary,
    marginTop: spacing.md,
  },
  emptySubtext: {
    fontSize: fontSize.sm,
    color: colors.textDisabled,
    marginTop: spacing.xs,
  },
});

export default ExerciseSearchScreen;
