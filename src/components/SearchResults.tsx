import { useMultiProductSearch } from '../../hooks/MultiProductSearch'

interface SearchResultsProps {
  queries: string[]
  onBackToSurvey?: () => void
}

export function SearchResults({ queries, onBackToSurvey }: SearchResultsProps) {
  const { results, isLoading } = useMultiProductSearch(queries, { 
    filters: { color: ['RED'] } 
  })

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin text-4xl">🔄</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex justify-between mb-8">
          <h1 className="text-3xl font-bold">Your Personalized Results</h1>
          <button 
            onClick={onBackToSurvey}
            className="px-4 py-2 bg-gray-100 rounded-lg hover:bg-gray-200"
          >
            Back to Survey
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {results.map((result, queryIndex) => (
            <div key={queryIndex} className="space-y-4">
              <h2 className="text-xl font-semibold capitalize">
                {queries[queryIndex]}
              </h2>
              <div className="grid gap-4">
                {result.products?.map((product: any, productIndex: number) => (
                  <div 
                    key={productIndex}
                    className="border rounded-lg p-4 hover:shadow-lg transition-shadow"
                  >
                    {product.featuredImage && (
                      <img 
                        src={product.featuredImage.url} 
                        alt={product.title}
                        className="w-full h-48 object-cover rounded-md"
                      />
                    )}
                    <h3 className="mt-2 font-medium">{product.title}</h3>
                    <p className="text-gray-600">${product.priceRange?.minVariantPrice?.amount}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}