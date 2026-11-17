# React + TypeScript + Vite

## API routing and deployment

Use `VITE_API_BASE_URL=/api/v1` locally and in the Vercel project's environment
settings. Vercel environment settings override the value in `.env`; redeploy
after changing them.

`vercel.json` forwards `/api/v1/*` to the configured Laravel backend before
applying the frontend page fallback. Vite uses the same backend through its
development proxy. If the backend address changes, update both configurations.

Before releasing, verify that the backend actually exposes `/api/v1/auth/me`.
The public Vercel endpoint must return a JSON session response (or a JSON 401
for a signed-out user), never `index.html`. Backend access restrictions must
also allow the proxy requests. The backend path and session behavior could not
be verified during this change because its Cloudflare layer returned 403.

This checkout's authentication differs from the currently deployed site's
session-based authentication. The routing correction does not migrate the
local mock authentication or establish compatibility with that backend.

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react/README.md) uses [Babel](https://babeljs.io/) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## Expanding the ESLint configuration

If you are developing a production application, we recommend updating the configuration to enable type aware lint rules:

- Configure the top-level `parserOptions` property like this:

```js
export default tseslint.config({
  languageOptions: {
    // other options...
    parserOptions: {
      project: ['./tsconfig.node.json', './tsconfig.app.json'],
      tsconfigRootDir: import.meta.dirname,
    },
  },
})
```

- Replace `tseslint.configs.recommended` to `tseslint.configs.recommendedTypeChecked` or `tseslint.configs.strictTypeChecked`
- Optionally add `...tseslint.configs.stylisticTypeChecked`
- Install [eslint-plugin-react](https://github.com/jsx-eslint/eslint-plugin-react) and update the config:

```js
// eslint.config.js
import react from 'eslint-plugin-react'

export default tseslint.config({
  // Set the react version
  settings: { react: { version: '18.3' } },
  plugins: {
    // Add the react plugin
    react,
  },
  rules: {
    // other rules...
    // Enable its recommended rules
    ...react.configs.recommended.rules,
    ...react.configs['jsx-runtime'].rules,
  },
})
```
