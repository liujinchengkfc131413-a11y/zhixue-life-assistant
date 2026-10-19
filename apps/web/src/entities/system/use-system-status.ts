import { useQuery } from '@tanstack/react-query';

import { apiClient } from '../../shared/api/client.js';

export const systemStatusQueryKey = ['system', 'status'] as const;

export const useSystemStatus = () =>
  useQuery({
    queryKey: systemStatusQueryKey,
    queryFn: async () => {
      const { data } = await apiClient.GET('/api/v1/system/status');
      if (data === undefined) {
        throw new Error('本地服务没有返回系统状态。');
      }

      return data.data;
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
