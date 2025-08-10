# Shopify Shop Mini SDK Analysis - Authentication & Product Querying

## Executive Summary

The Shopify Shop Mini SDK (`@shopify/shop-minis-react` v0.0.30) provides a comprehensive set of hooks for both authenticated and unauthenticated data access. **Product querying works without authentication**, while user-specific features require the user to be logged into the Shop app.

## Authentication Architecture

### Development vs Production Authentication

**Key Insight:** Authentication is handled automatically by the Shop app context - no manual login implementation needed.

#### Development Environment

- Authentication works through the Shop Mini development server
- When running `npx shop-minis dev`, the SDK provides:
  - Mock user sessions for testing authenticated features
  - Access to real Shop app authentication when available
  - Fallback to unauthenticated mode for public features

#### Production Environment

- Authentication handled by the Shop app automatically
- Users are already logged into Shop app when accessing Mini
- SDK inherits authentication context seamlessly

### Authentication Patterns

```typescript
import { useCurrentUser } from "@shopify/shop-minis-react";

function MyComponent() {
  const { currentUser, loading, error } = useCurrentUser();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  if (currentUser) {
    // User is authenticated - access user-specific data
    return <AuthenticatedExperience user={currentUser} />;
  } else {
    // User not authenticated - use public features only
    return <PublicExperience />;
  }
}
```

## Product Querying Capabilities

### Public Product Access (No Authentication Required)

```typescript
// Popular products across platform
const { products } = usePopularProducts();

// Curated collections
const { products } = useCuratedProducts();

// Search functionality
const { products, search } = useProductSearch();

// Product recommendations
const { products } = useRecommendedProducts();

// Single product details
const { product } = useProduct({ productId: "gid://shopify/Product/123" });
```

### User-Specific Product Access (Authentication Required)

```typescript
// User's saved/favorite products
const { products } = useSavedProducts();

// Recently viewed products
const { products } = useRecentProducts();

// User's order history
const { orders } = useOrders();

// Buyer attributes for personalization
const { attributes } = useBuyerAttributes();
```

## Complete Hook Inventory

### User Authentication & Profile

- `useCurrentUser()` - Current user profile and authentication state
- `useBuyerAttributes()` - User preferences and behavioral data
- `useCreateGuestUser()` - Create guest user session
- `useEmailConfirmation()` - Email verification utilities

### Product Data Hooks

#### Public Access

- `usePopularProducts()` - Popular products globally
- `useCuratedProducts()` - Editorial collections
- `useRecommendedProducts()` - Algorithm-based recommendations
- `useProduct(id)` - Single product details
- `useProducts(ids)` - Multiple product details
- `useProductVariants(productId)` - Product variants
- `useProductMedia(productId)` - Product images/videos
- `useProductSearch()` - Search functionality

#### User-Specific

- `useSavedProducts()` - User's favorites
- `useRecentProducts()` - Recently viewed
- `useProductList()` - User's custom lists
- `useProductListActions()` - Manage product lists

### Commerce Actions

- `useShopCartActions()` - Add to cart, update quantities
- `useSavedProductsActions()` - Save/unsave products
- `useFollowedShopsActions()` - Follow/unfollow shops

### Shop & Navigation

- `useShop()` - Current shop information
- `useFollowedShops()` - Shops user follows
- `useRecentShops()` - Recently visited shops
- `useShopNavigation()` - Navigate within Shop app
- `useCloseMini()` - Close current Mini
- `useDeeplink()` - Handle deep links

### Storage & Utilities

- `useAsyncStorage()` - Persistent storage
- `useSecureStorage()` - Encrypted storage
- `useImageUpload()` - Upload images
- `useImagePicker()` - Select images
- `useShare()` - Share content
- `useErrorToast()` - Show error messages

## Implementation Strategy for Personality Shopping

### Phase 1: Public Product Access

```typescript
// Start with unauthenticated product recommendations
const { products } = useRecommendedProducts();
const { products: popular } = usePopularProducts();
const { products: searchResults, search } = useProductSearch();
```

### Phase 2: Enhanced Personalization (When User Available)

```typescript
const { currentUser } = useCurrentUser();
const { attributes } = useBuyerAttributes(); // User preferences
const { products: saved } = useSavedProducts(); // User favorites
const { orders } = useOrders(); // Purchase history
```

### Phase 3: Full Commerce Integration

```typescript
const { addToCart } = useShopCartActions();
const { saveProduct } = useSavedProductsActions();
const { navigate } = useShopNavigation();
```

## Data Structure Examples

### Product Object Structure

```typescript
interface Product {
  id: string; // GID format: 'gid://shopify/Product/123'
  title: string;
  description: string;
  featuredImage?: {
    url: string;
    altText?: string;
  };
  priceRange: {
    minVariantPrice: {
      amount: string;
      currencyCode: string;
    };
    maxVariantPrice: {
      amount: string;
      currencyCode: string;
    };
  };
  variants: ProductVariant[];
  vendor: string;
  productType: string;
  tags: string[];
}
```

### User Profile Structure

```typescript
interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  // Additional profile data
}
```

### Buyer Attributes Structure

```typescript
interface BuyerAttributes {
  genderAffinity?: "masculine" | "feminine" | "neutral";
  categoryAffinities: Array<{
    category: string;
    affinity: number; // 0-1 score
  }>;
  pricePreferences: {
    min?: number;
    max?: number;
    currency: string;
  };
  // Additional behavioral data
}
```

## Development Testing Approaches

### 1. Mock Data Testing

```typescript
// Works in development without authentication
const { products } = usePopularProducts();
// Returns real product data for testing UI
```

### 2. Authenticated Feature Testing

```typescript
// Test with development authentication
const { currentUser } = useCurrentUser();
// SDK provides mock user in development mode
```

### 3. Hybrid Approach

```typescript
function PersonalityShop() {
  const { currentUser } = useCurrentUser();
  const { products: popular } = usePopularProducts();
  const { attributes } = useBuyerAttributes();

  // Works with or without authentication
  const personalizedProducts = currentUser
    ? getPersonalizedRecommendations(popular, attributes)
    : popular;

  return <ProductGrid products={personalizedProducts} />;
}
```

## Key Insights for Implementation

### ✅ What Works Now

1. **Product querying** - Full access to product catalog without authentication
2. **Basic commerce** - Product display, search, recommendations
3. **Development environment** - Complete testing capabilities
4. **Hybrid experiences** - Graceful degradation when user not authenticated

### ⚠️ Authentication Considerations

1. **Automatic handling** - Authentication managed by Shop app, not Mini
2. **Progressive enhancement** - Build for unauthenticated first, enhance when user available
3. **Development testing** - SDK provides mock authentication contexts

### 🎯 Perfect for Personality Shopping

1. **Public product access** - Can query any products for recommendations
2. **User enhancement** - Can access buyer attributes and preferences when available
3. **Storage capabilities** - Can persist personality profiles locally
4. **Commerce actions** - Can save products and add to cart

## Recommended Next Steps

1. **Start with public products** - Use `usePopularProducts` and `useRecommendedProducts`
2. **Add authentication detection** - Use `useCurrentUser` to detect logged-in state
3. **Implement progressive enhancement** - Enhance experience when user data available
4. **Test in development** - Use development server for full feature testing
5. **Persist personality data** - Use `useAsyncStorage` for personality profiles

This architecture perfectly supports the personality-driven shopping concept with both anonymous and authenticated user experiences.
