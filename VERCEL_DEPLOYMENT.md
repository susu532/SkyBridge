# Vercel Deployment Instructions

This guide explains how to deploy the SkyBridge frontend to Vercel.

## Overview

This repository contains a full-stack application with:

- Frontend: React/Vite application
- Backend: Node.js/Socket.io server (to be deployed elsewhere)

For Vercel deployment, we will only deploy the frontend since Vercel is optimized for static sites and serverless functions, but does not support long-lived WebSocket connections required by Socket.io.

## Deployment Steps

### Option 1: Vercel CLI (Recommended)

1. Install Vercel CLI:

   ```bash
   npm i -g vercel
   ```

2. Login to Vercel:

   ```bash
   vercel login
   ```

3. Deploy from the project root:

   ```bash
   vercel
   ```

4. Follow the prompts:
   - Set project name (or accept default)
   - Confirm directory is `./`
   - Accept the default build command (`vite build`)
   - Accept the default output directory (`dist`)

### Option 2: Git Integration

1. Push your code to a GitHub/GitLab/Bitbucket repository
2. Import the project in Vercel dashboard
3. Vercel will automatically detect the framework and settings
4. Configure:
   - Build Command: `vite build`
   - Output Directory: `dist`
   - Environment Variables: Add `GEMINI_API_KEY` if needed

## Important Notes

### Backend Connection

The frontend needs to connect to your backend server. Make sure to:

1. Deploy your backend to a service that supports WebSockets (like Render, Railway, or a traditional VPS)
2. Update the frontend to connect to your backend URL
3. The backend URL should be configured in your frontend code or environment variables

### Environment Variables

If your frontend requires environment variables:

1. Add them in Vercel Project Settings → Environment Variables
2. They will be available at build time via `import.meta.env.VARIABLE_NAME`

### Build Output

Vercel will run `vite build` which generates optimized static assets in the `dist` directory, then serve them via Vercel's CDN.

## Troubleshooting

### Build Failures

If you encounter build failures:

1. Ensure you have the correct Node.js version (check package.json engines if specified)
2. Clear Vercel cache and rebuild
3. Check that all dependencies are correctly listed in package.json

### Routing Issues

Since this is a single-page application, Vercel is configured to route all requests to `/index.html` via the `routes` configuration in `vercel.json`. This ensures client-side routing works correctly.

## Additional Resources

- Vercel Documentation: https://vercel.com/docs
- Vite Documentation: https://vitejs.dev/guide/
- Deploying React Apps to Vercel: https://vercel.com/guides/deploying-react-with-vercel
