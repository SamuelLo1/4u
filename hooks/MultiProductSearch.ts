import {useMemo } from 'react'
import { useProductSearch } from '@shopify/shop-minis-react'

export function useMultiProductSearch(queries: string[], options = {}) {
  // Call hooks at the top level, one for each query
  const searchResults = queries.map(query => 
    useProductSearch({
      query,
      first: 10,
      ...options
    })
  )

  // Use useMemo to derive the combined results
  const results = useMemo(() => 
    searchResults.map(result => ({
      products: result.products,
      loading: result.loading
    })), 
    [searchResults]
  )

  // Calculate loading state from all results
  const isLoading = useMemo(() => 
    searchResults.some(result => result.loading),
    [searchResults]
  )

  return {
    results,
    isLoading,
    isEmpty: results.length === 0
  }
} 