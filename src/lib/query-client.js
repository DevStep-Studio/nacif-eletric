import { QueryClient } from '@tanstack/react-query';


export const queryClientInstance = new QueryClient({
	defaultOptions: {
		queries: {
			refetchOnWindowFocus: false,
			staleTime: 1000 * 60 * 2, // 2 minutos de frescor para navegação sem refetch desnecessário
			gcTime: 1000 * 60 * 10,   // 10 minutos de retenção de memória cache
			retry: (failureCount, error) => {
				// Não repetir erros definitivos de permissão ou inexistência
				if (error?.status === 401 || error?.status === 403 || error?.status === 404) return false;
				return failureCount < 2;
			},
			retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000), // Backoff exponencial suave
		},
		mutations: {
			retry: false, // Operações de escrita não idempotentes não devem sofrer repetição cega
		},
	},
});