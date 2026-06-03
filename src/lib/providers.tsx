'use client'

import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { ReactQueryDevtools } from '@tanstack/react-query-devtools'
import { useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  // One QueryClient per browser session; useState ensures it's not recreated on re-render
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime:            1000 * 60 * 5,  // 5 min — data considered fresh
            gcTime:               1000 * 60 * 30, // 30 min — garbage collect unused cache
            refetchOnWindowFocus: false,           // don't refetch every tab switch
            retry:                2,
          },
        },
      })
  )

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === 'development' && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  )
}
