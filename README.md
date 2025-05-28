# QuizAI

AI-powered quiz generation application built with React and Vite.

## Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment file:
   ```bash
   cp .env.example .env
   ```

4. Add your Gemini API key to `.env`:
   ```
   GEMINI_API_KEY=your_actual_api_key_here
   ```

## Development

```bash
npm run dev
```

## Deployment to GitHub Pages

This project uses GitHub Actions for automated deployment to GitHub Pages.

### Setup GitHub Actions Deployment:

1. **Add your Gemini API key to GitHub Secrets:**
   - Go to your repository on GitHub
   - Navigate to Settings > Secrets and variables > Actions
   - Add a new repository secret:
     - Name: `GEMINI_API_KEY`
     - Value: Your actual Gemini API key

2. **Push to main branch:**
   ```bash
   git add .
   git commit -m "Add deployment configuration"
   git push origin main
   ```

3. **The GitHub Action will automatically:**
   - Build the project with your API key
   - Deploy to GitHub Pages

### Manual Deployment (Alternative):

If you prefer manual deployment:

```bash
npm run predeploy
npm run deploy
```

**Note:** Manual deployment won't include environment variables, so the Gemini API functionality won't work on the deployed site.

## Environment Variables

- `GEMINI_API_KEY`: Required for AI quiz generation functionality

## Tech Stack

- React 19
- TypeScript
- Vite
- Google Gemini AI
- React Router
- Framer Motion
