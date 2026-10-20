import { useCallback, useState } from 'react';
import { RefreshControl } from 'react-native';
import { useTheme } from '../theme/ThemeProvider';

/** A themed RefreshControl that shows its spinner while `refetch` runs. */
export function usePullToRefresh(refetch: () => Promise<unknown>) {
  const { colors } = useTheme();
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);
  return (
    <RefreshControl
      refreshing={refreshing}
      onRefresh={onRefresh}
      colors={[colors.accent]}
      tintColor={colors.accent}
      progressBackgroundColor={colors.surface}
    />
  );
}
