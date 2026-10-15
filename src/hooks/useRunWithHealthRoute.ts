import { useCallback, useEffect, useState } from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { Run } from '../types';
import { useSettings } from '../context/SettingsContext';
import { importHealthRoute } from '../services/healthService';
import { getRunById, parseRoute } from '../services/runService';

export function useRunWithHealthRoute(initialRun: Run) {
  const [run, setRun] = useState(initialRun);
  const [loadingRoute, setLoadingRoute] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const { settings } = useSettings();
  useEffect(() => setRun(initialRun), [initialRun.id]);
  useFocusEffect(useCallback(() => {
    let active = true;
    getRunById(initialRun.id).then(saved => { if (active && saved) setRun(saved); }).catch(() => undefined);
    return () => { active = false; };
  }, [initialRun.id]));
  const hasRoute = parseRoute(run).length > 1;
  useFocusEffect(useCallback(() => {
    if (hasRoute || run.isIndoor || !settings.healthSyncEnabled) return;
    let active = true;
    setLoadingRoute(true);
    setRouteError(false);
    importHealthRoute(run.id).then(routeCoordinates => {
      if (active && routeCoordinates) setRun(current => ({ ...current, routeCoordinates }));
    }).catch(() => { if (active) setRouteError(true); }).finally(() => {
      if (active) setLoadingRoute(false);
    });
    return () => { active = false; setLoadingRoute(false); };
  }, [run.id, run.isIndoor, hasRoute, settings.healthSyncEnabled, attempt]));
  return { run, setRun, loadingRoute, routeError, retryRoute: () => setAttempt(value => value + 1) };
}
