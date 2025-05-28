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
   - Click on "New repository secret"
   - Add a new repository secret:
     - Name: `GEMINI_API_KEY` (phải chính xác tên này)
     - Value: Your actual Gemini API key

2. **Push GitHub Actions workflow file:**
   ```bash
   git add .github/workflows/deploy.yml
   git commit -m "Add GitHub Actions workflow for deployment"
   git push origin main
   ```

3. **Manually trigger the workflow (if needed):**
   - Go to your repository on GitHub
   - Navigate to Actions tab
   - Select the "Deploy to GitHub Pages" workflow
   - Click "Run workflow" button
   - Select the branch (main) and click "Run workflow"

4. **The GitHub Action will automatically:**
   - Build the project with your API key
   - Deploy to GitHub Pages

5. **Verify deployment:**
   - Check Actions tab to see if the workflow completed successfully
   - If there are any errors, check the logs for details

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
