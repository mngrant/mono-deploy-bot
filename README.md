# Slack Deploy Bot

A Slack bot that allows triggering deployments directly from Slack channels.

## Deploying to Vercel

### Prerequisites

1. A Slack app with the following permissions:
   - `app_mentions:read`
   - `chat:write`
   - `commands`
   - Interactive Components enabled

2. Vercel account

### Setup Steps

1. Fork or clone this repository.

2. Install Vercel CLI (if you haven't already):
   ```
   npm install -g vercel
   ```

3. Update your environment variables in Vercel:
   - Go to your Vercel dashboard
   - Select your project
   - Go to Settings > Environment Variables
   - Add the following variables:
     - `SLACK_BOT_TOKEN`: Your Slack bot token
     - `SLACK_SIGNING_SECRET`: Your Slack app signing secret
     - `DEPLOY_API_ENDPOINT`: API endpoint for your deployment service
     - `DEPLOYMENT_KEY`: Authorization key for your deployment API

4. Deploy to Vercel:
   ```
   vercel
   ```

5. After the initial deployment, update your Slack app configuration:
   - Go to your Slack app settings at api.slack.com
   - Under "Event Subscriptions", set the Request URL to:
     `https://your-vercel-app.vercel.app/slack/events`
   - Under "Interactivity & Shortcuts", set the Request URL to:
     `https://your-vercel-app.vercel.app/slack/events`

6. For production deployment:
   ```
   vercel --prod
   ```

## Local Development

1. Install dependencies:
   ```
   npm install
   ```

2. Create a `.env` file with the required environment variables.

3. Start the development server:
   ```
   npm run dev
   ```

## Configuration

The app automatically uses Socket Mode for local development and HTTP mode when deployed to Vercel.