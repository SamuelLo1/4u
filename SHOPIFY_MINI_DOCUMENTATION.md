# Shopify Shop Mini Documentation

## Official Documentation Overview

### What are Shop Minis?
Shop Minis are immersive, full-screen mobile experiences within the Shop app, designed to be:
- **Fast and responsive**
- **Easy to develop and maintain**  
- **Secure and reliable**

### Key Characteristics
- Built using a React SDK
- Targeted at mobile shopping experiences
- Currently in an Early Access Program (invitation-only)
- Enables developers to create custom shopping features
- Reaches "millions of shoppers instantly in the Shop app"

### Development Requirements
- Node.js version 20 or higher
- XCode or Android Studio
- Invitation to Early Access Program

### Getting Started Commands
```bash
# Create a new project
npm init @shopify/shop-mini@latest

# Start development server
npx shop-minis dev
```

### Development Features
- Preview on Android emulator/device
- Preview on iOS simulator/device
- QR code scanning for physical device testing

### SDK Components Available
- **Primitives** (UI components)
- **Commerce components**
- **Hooks for:**
  - Storage
  - User interactions
  - Navigation
  - Product management
  - Content creation

---

## Current Application Structure

### Project Overview
- **Name:** tutorial
- **Version:** 0.0.1
- **Description:** A Shop Mini with WebView and Vite
- **Framework:** React 18.2.0 with TypeScript

### File Structure
```
/Users/brianliu/Developer/shopify-mini/4u/
├── README.md
├── index.html
├── package-lock.json
├── package.json
├── src/
│   ├── App.tsx
│   ├── icon.png
│   ├── index.css
│   ├── main.tsx
│   └── manifest.json
├── tsconfig.json
└── vite.config.mjs
```

### Dependencies

#### Production Dependencies
- `@shopify/shop-minis-react`: 0.0.30
- `react`: 18.2.0
- `react-dom`: 18.2.0

#### Development Dependencies
- `@shopify/shop-minis-cli`: 0.0.175
- `@tailwindcss/vite`: ^4.1.8
- `@types/react`: ^18.2.43
- `@types/react-dom`: ^18.2.17
- `@vitejs/plugin-react`: ^4.2.1
- `tailwindcss`: ^4.1.8
- `typescript`: ^5.8.3

### Configuration Files

#### Package.json Scripts
```json
{
  "scripts": {
    "start": "shop-minis dev"
  }
}
```

#### Manifest.json (`src/manifest.json`)
```json
{
  "name": "tutorial",
  "permissions": [],
  "privacy_policy_url": "https://example.com/privacy",
  "terms_url": "https://example.com/terms"
}
```

#### Vite Configuration (`vite.config.mjs`)
- Uses React plugin
- Includes TailwindCSS plugin
- Optimizes `@shopify/shop-minis-react` dependency

#### TypeScript Configuration (`tsconfig.json`)
- Strict TypeScript settings enabled
- React JSX support
- ES2019 + DOM libraries
- ESNext modules with bundler resolution

### Current Application Code

#### Main Entry Point (`src/main.tsx`)
```tsx
import {StrictMode} from 'react'
import {createRoot} from 'react-dom/client'
import './index.css'
import {MinisContainer} from '@shopify/shop-minis-react'
import {App} from './App.jsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MinisContainer>
      <App />
    </MinisContainer>
  </StrictMode>
)
```

#### Main App Component (`src/App.tsx`)
```tsx
import {usePopularProducts, ProductCard} from '@shopify/shop-minis-react'

export function App() {
  const {products} = usePopularProducts()

  return (
    <div className="pt-12 px-4 pb-6">
      <h1 className="text-2xl font-bold mb-2 text-center">
        Welcome to Shop Minis!
      </h1>
      <p className="text-xs text-blue-600 mb-4 text-center bg-blue-50 py-2 px-4 rounded border border-blue-200">
        🛠️ Edit <b>src/App.tsx</b> to change this screen and come back to see
        your edits!
      </p>
      <p className="text-base text-gray-600 mb-6 text-center">
        These are the popular products today
      </p>
      <div className="grid grid-cols-2 gap-4">
        {products?.map(product => (
          <ProductCard key={product.id} product={product} />
        ))}
      </div>
    </div>
  )
}
```

### Current Application Features
1. **Popular Products Display**: Uses `usePopularProducts` hook to fetch and display popular products
2. **Product Cards**: Renders products in a 2-column grid layout using `ProductCard` component
3. **TailwindCSS Styling**: Uses utility-first CSS framework for responsive design
4. **Development Instructions**: Includes helpful text showing developers how to edit the app

### Development Workflow
1. Run `npx shop-minis dev` to start development server
2. Edit `src/App.tsx` to make changes
3. Changes are hot-reloaded in development
4. Can preview on mobile devices via QR code scanning

### Key Shopify Shop Mini Concepts Used
- **MinisContainer**: Wrapper component that provides Shop Mini context
- **usePopularProducts**: Hook for fetching popular product data
- **ProductCard**: Pre-built component for displaying product information
- **Manifest permissions**: Currently empty array (no special permissions required)

### Next Steps for Development
- Add more commerce hooks (cart, user, navigation)
- Implement custom product filtering or search
- Add more interactive features using Shop Mini SDK
- Configure proper privacy policy and terms URLs
- Add custom styling and branding
- Implement additional commerce functionality like cart management