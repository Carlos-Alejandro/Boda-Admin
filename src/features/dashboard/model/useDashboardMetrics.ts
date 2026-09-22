import { useEffect, useRef, useState } from 'react';
import { getInvitations } from '../../invitations/api/invitationService';
import { calculateDashboardMetrics, type DashboardMetrics } from './calculateDashboardMetrics';
import { buildDashboardDetails, type DashboardDetails } from './buildDashboardDetails';

type DashboardState =
 | { status: 'loading' }
 | { status: 'error' }
 | { status: 'success'; metrics: DashboardMetrics; details: DashboardDetails; consultedAt: string };

export function useDashboardMetrics() {
 const [state, setState] = useState<DashboardState>({ status: 'loading' });
 const [attempt, setAttempt] = useState(0);
 const request = useRef<ReturnType<typeof getInvitations> | null>(null);

 useEffect(() => {
  let subscribed = true;
  // Reuse the request when StrictMode repeats effect setup in development.
  request.current ??= getInvitations();
  void request.current.then(({ items, total }) => {
   // Do not silently publish partial totals if the list contract changes.
   if (total !== items.length) throw new Error('Incomplete invitation list');
   const metrics = calculateDashboardMetrics(items);
   if (subscribed) setState({ status: 'success', metrics, details: buildDashboardDetails(items), consultedAt: new Date().toISOString() });
  }).catch(() => {
   if (subscribed) setState({ status: 'error' });
  });
  return () => { subscribed = false; };
 }, [attempt]);

 const retry = () => {
  if (state.status !== 'error' || request.current === null) return;
  request.current = null;
  setState({ status: 'loading' });
  setAttempt((value) => value + 1);
 };
 return { state, retry };
}
