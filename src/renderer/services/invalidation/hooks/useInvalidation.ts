import { useEffect, useRef } from 'react';
import {
  subscribeInvalidation,
  type InvalidationSubscription,
} from '@renderer/services/invalidation/invalidation';

export function useInvalidation(subscription: InvalidationSubscription): void {
  const subscriptionRef = useRef(subscription);
  subscriptionRef.current = subscription;
  const sourcesKey = subscription.sources.join(',');
  const actionsKey = subscription.actions?.join(',') ?? '';
  const debounceMs = subscription.debounceMs ?? 0;

  useEffect(
    () =>
      subscribeInvalidation({
        sources: subscriptionRef.current.sources,
        actions: subscriptionRef.current.actions,
        debounceMs: subscriptionRef.current.debounceMs,
        filter: (event) => subscriptionRef.current.filter?.(event) ?? true,
        guard: () => subscriptionRef.current.guard?.() ?? true,
        invalidate: (event) => subscriptionRef.current.invalidate(event),
      }),
    [actionsKey, debounceMs, sourcesKey],
  );
}
