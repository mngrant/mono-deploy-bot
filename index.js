const { App, ExpressReceiver } = require('@slack/bolt');
require('dotenv').config();

// Create a custom receiver to manage HTTP requests
const receiver = new ExpressReceiver({
  signingSecret: process.env.SLACK_SIGNING_SECRET,
  processBeforeResponse: true
});

// Initialize the app with the receiver
const app = new App({
  token: process.env.SLACK_BOT_TOKEN,
  receiver
});

// Local development mode - use socket mode when running locally
if (process.env.NODE_ENV !== 'production') {
  const { App: SocketApp } = require('@slack/bolt');
  const socketApp = new SocketApp({
    token: process.env.SLACK_BOT_TOKEN, 
    appToken: process.env.SLACK_APP_TOKEN,
    socketMode: true,
  });

  (async () => {
    await socketApp.start();
    console.log('⚡️ Bolt app started in Socket Mode');
  })();
} else {
  // In production, the receiver will handle the HTTP requests
  console.log('⚡️ Bolt app ready in HTTP mode');
}

// subscribe to 'app_mention' event in your App config
// need app_mentions:read and chat:write scopes
app.event('app_mention', async ({ event, context, client, say }) => {
  try {
    await say({
      "text": `Hello <@${event.user}>, click here to deploy!`,
      "blocks": [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `Hello <@${event.user}>, click here to deploy!`
          },
          "accessory": {
            "type": "button",
            "text": {
              "type": "plain_text",
              "text": "Deploy",
              "emoji": true
            },
            "value": "click_me_123",
            "action_id": "deploy_button"
          }
        }
      ]
    });
  }
  catch (error) {
    console.error(error);
  }
});

// Handle the button click action
app.action('deploy_button', async ({ body, ack, say }) => {
  // Acknowledge the action
  await ack();
  
  try {
    // Inform the channel that deployment has started
    // await say(`Deployment triggered by <@${body.user.id}>`);

    await fetch(process.env.DEPLOY_API_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-deployment-key': process.env.DEPLOYMENT_KEY,
      }
    });
    
    await say({
      text: `Deployment triggered by <@${body.user.id}>! :rocket:\nIt will take about 10 minutes.`,
      blocks: [
        {
          "type": "section",
          "text": {
            "type": "mrkdwn",
            "text": `:white_check_mark: Deployment triggered by <@${body.user.id}>! :rocket:\nIt will take about 10 minutes.`
          }
        }
      ]
    });
  } catch (error) {
    console.error(error);
    await say(`Failed to start deployment: ${error.message}`);
  }
});

// Export the receiver's request handler for Vercel
module.exports = receiver.app;