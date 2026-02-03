import { Badge } from '../types';

// All achievement badges for Big Fella Athletics
export const badges: Omit<Badge, 'earnedDate' | 'isEarned'>[] = [
  // STREAK BADGES
  {
    id: 'streak-7',
    name: 'Week Warrior',
    description: 'Maintain a 7-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-14',
    name: 'Two Week Triumph',
    description: 'Maintain a 14-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-30',
    name: 'Monthly Master',
    description: 'Maintain a 30-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-50',
    name: 'Fifty Day Fire',
    description: 'Maintain a 50-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-100',
    name: 'Century Streak',
    description: 'Maintain a 100-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-200',
    name: 'Double Century',
    description: 'Maintain a 200-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-365',
    name: 'Year-Round Runner',
    description: 'Maintain a 365-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-500',
    name: 'Legendary Streak',
    description: 'Maintain a 500-day run streak',
    category: 'streak',
    iconName: 'flame',
  },
  {
    id: 'streak-1000',
    name: 'Unstoppable',
    description: 'Maintain a 1000-day run streak',
    category: 'streak',
    iconName: 'flame',
  },

  // DISTANCE BADGES
  {
    id: 'distance-50',
    name: 'First Fifty',
    description: 'Run 50 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-100',
    name: 'Century Runner',
    description: 'Run 100 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-250',
    name: 'Road Warrior',
    description: 'Run 250 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-500',
    name: 'Half Thousand',
    description: 'Run 500 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-1000',
    name: 'Thousand Miler',
    description: 'Run 1000 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-2500',
    name: 'Marathon Master',
    description: 'Run 2500 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },
  {
    id: 'distance-5000',
    name: 'Ultra Legend',
    description: 'Run 5000 miles total',
    category: 'distance',
    iconName: 'map-marker-distance',
  },

  // STRENGTH BADGES - Bench Press
  {
    id: 'bench-135',
    name: 'One Plate Bench',
    description: 'Bench press 135 lbs (1 plate per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'bench-185',
    name: 'Big Boy Bench',
    description: 'Bench press 185 lbs',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'bench-225',
    name: 'Two Plate Bench',
    description: 'Bench press 225 lbs (2 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'bench-275',
    name: 'Advanced Bencher',
    description: 'Bench press 275 lbs',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'bench-315',
    name: 'Three Plate Bench',
    description: 'Bench press 315 lbs (3 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'bench-405',
    name: 'Four Plate Bench',
    description: 'Bench press 405 lbs (4 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },

  // STRENGTH BADGES - Squat
  {
    id: 'squat-135',
    name: 'One Plate Squat',
    description: 'Squat 135 lbs (1 plate per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'squat-225',
    name: 'Two Plate Squat',
    description: 'Squat 225 lbs (2 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'squat-315',
    name: 'Three Plate Squat',
    description: 'Squat 315 lbs (3 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'squat-405',
    name: 'Four Plate Squat',
    description: 'Squat 405 lbs (4 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'squat-495',
    name: 'Five Plate Squat',
    description: 'Squat 495 lbs (5 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },

  // STRENGTH BADGES - Deadlift
  {
    id: 'deadlift-135',
    name: 'One Plate Deadlift',
    description: 'Deadlift 135 lbs (1 plate per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'deadlift-225',
    name: 'Two Plate Deadlift',
    description: 'Deadlift 225 lbs (2 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'deadlift-315',
    name: 'Three Plate Deadlift',
    description: 'Deadlift 315 lbs (3 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'deadlift-405',
    name: 'Four Plate Deadlift',
    description: 'Deadlift 405 lbs (4 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'deadlift-495',
    name: 'Five Plate Deadlift',
    description: 'Deadlift 495 lbs (5 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },
  {
    id: 'deadlift-585',
    name: 'Six Plate Deadlift',
    description: 'Deadlift 585 lbs (6 plates per side)',
    category: 'strength',
    iconName: 'weight-lifter',
  },

  // CONSISTENCY BADGES
  {
    id: 'consistency-4weeks',
    name: 'Month of Muscle',
    description: 'Complete at least 3 workouts per week for 4 weeks',
    category: 'consistency',
    iconName: 'calendar-check',
  },
  {
    id: 'consistency-8weeks',
    name: 'Dedicated Lifter',
    description: 'Complete at least 3 workouts per week for 8 weeks',
    category: 'consistency',
    iconName: 'calendar-check',
  },
  {
    id: 'consistency-12weeks',
    name: 'Quarter Commitment',
    description: 'Complete at least 3 workouts per week for 12 weeks',
    category: 'consistency',
    iconName: 'calendar-check',
  },
  {
    id: 'consistency-6months',
    name: 'Half Year Hero',
    description: 'Complete at least 3 workouts per week for 6 months',
    category: 'consistency',
    iconName: 'calendar-check',
  },
  {
    id: 'consistency-1year',
    name: 'Iron Addict',
    description: 'Complete at least 3 workouts per week for 1 year',
    category: 'consistency',
    iconName: 'calendar-check',
  },
  {
    id: 'workouts-10',
    name: 'Getting Started',
    description: 'Complete 10 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },
  {
    id: 'workouts-50',
    name: 'Regular',
    description: 'Complete 50 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },
  {
    id: 'workouts-100',
    name: 'Century Club',
    description: 'Complete 100 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },
  {
    id: 'workouts-250',
    name: 'Gym Regular',
    description: 'Complete 250 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },
  {
    id: 'workouts-500',
    name: 'Dedicated',
    description: 'Complete 500 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },
  {
    id: 'workouts-1000',
    name: 'Thousand Strong',
    description: 'Complete 1000 workouts',
    category: 'consistency',
    iconName: 'dumbbell',
  },

  // DEDICATION BADGES
  {
    id: 'early-bird',
    name: 'Early Bird',
    description: 'Complete a run before 6am',
    category: 'dedication',
    iconName: 'weather-sunny',
  },
  {
    id: 'night-owl',
    name: 'Night Owl',
    description: 'Complete a run after 9pm',
    category: 'dedication',
    iconName: 'weather-night',
  },
  {
    id: 'early-bird-10',
    name: 'Dawn Patrol',
    description: 'Complete 10 runs before 6am',
    category: 'dedication',
    iconName: 'weather-sunny',
  },
  {
    id: 'weekend-warrior',
    name: 'Weekend Warrior',
    description: 'Complete workouts on both Saturday and Sunday',
    category: 'dedication',
    iconName: 'calendar-weekend',
  },
  {
    id: 'double-day',
    name: 'Double Day',
    description: 'Log both a workout and a run on the same day',
    category: 'dedication',
    iconName: 'star',
  },
  {
    id: 'hybrid-athlete',
    name: 'Hybrid Athlete',
    description: 'Log 10 workouts and 10 runs in the same month',
    category: 'dedication',
    iconName: 'star-four-points',
  },

  // VOLUME BADGES
  {
    id: 'volume-10k',
    name: 'Ten Thousand Pounds',
    description: 'Lift 10,000 lbs in a single workout',
    category: 'strength',
    iconName: 'weight',
  },
  {
    id: 'volume-25k',
    name: 'Twenty-Five K Club',
    description: 'Lift 25,000 lbs in a single workout',
    category: 'strength',
    iconName: 'weight',
  },
  {
    id: 'volume-50k',
    name: 'Fifty Thousand',
    description: 'Lift 50,000 lbs in a single workout',
    category: 'strength',
    iconName: 'weight',
  },
  {
    id: 'volume-100k',
    name: 'Hundred K Hero',
    description: 'Lift 100,000 lbs in a single workout',
    category: 'strength',
    iconName: 'weight',
  },
  {
    id: 'total-volume-1m',
    name: 'Million Pounder',
    description: 'Lift 1,000,000 lbs total',
    category: 'strength',
    iconName: 'weight',
  },
  {
    id: 'total-volume-10m',
    name: 'Ten Million Club',
    description: 'Lift 10,000,000 lbs total',
    category: 'strength',
    iconName: 'weight',
  },

  // SPEED BADGES
  {
    id: 'pace-sub-10',
    name: 'Sub-10 Pace',
    description: 'Run at a pace under 10:00/mile',
    category: 'speed',
    iconName: 'speedometer',
  },
  {
    id: 'pace-sub-9',
    name: 'Sub-9 Pace',
    description: 'Run at a pace under 9:00/mile',
    category: 'speed',
    iconName: 'speedometer',
  },
  {
    id: 'pace-sub-8',
    name: 'Sub-8 Pace',
    description: 'Run at a pace under 8:00/mile',
    category: 'speed',
    iconName: 'speedometer',
  },
  {
    id: 'pace-sub-7',
    name: 'Sub-7 Pace',
    description: 'Run at a pace under 7:00/mile',
    category: 'speed',
    iconName: 'speedometer',
  },
  {
    id: 'pace-sub-6',
    name: 'Sub-6 Pace',
    description: 'Run at a pace under 6:00/mile',
    category: 'speed',
    iconName: 'speedometer',
  },

  // FIRST TIME BADGES
  {
    id: 'first-workout',
    name: 'First Lift',
    description: 'Log your first workout',
    category: 'dedication',
    iconName: 'trophy',
  },
  {
    id: 'first-run',
    name: 'First Steps',
    description: 'Log your first run',
    category: 'dedication',
    iconName: 'trophy',
  },
  {
    id: 'first-pr',
    name: 'Personal Best',
    description: 'Set your first personal record',
    category: 'strength',
    iconName: 'trophy',
  },
];

// Helper function to get badges by category
export const getBadgesByCategory = (category: string) => {
  return badges.filter((badge) => badge.category === category);
};

// Helper function to get badge by ID
export const getBadgeById = (id: string) => {
  return badges.find((badge) => badge.id === id);
};
