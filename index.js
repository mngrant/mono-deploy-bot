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
app.action('deploy_button', async ({ body, ack, client }) => {
  // Acknowledge the action
  await ack();
  
  try {
    // Open a modal for password confirmation
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "deploy_confirmation_view",
        title: {
          type: "plain_text",
          text: "Deployment Confirmation",
          emoji: true
        },
        submit: {
          type: "plain_text",
          text: "Deploy",
          emoji: true
        },
        close: {
          type: "plain_text",
          text: "Cancel",
          emoji: true
        },
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: "Please enter the deployment password to confirm:"
            }
          },
          {
            type: "input",
            block_id: "deployment_password_block",
            element: {
              type: "plain_text_input",
              action_id: "deployment_password",
              placeholder: {
                type: "plain_text",
                text: "Enter password"
              },
              is_password: true
            },
            label: {
              type: "plain_text",
              text: "Password",
              emoji: true
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error(error);
  }
});

// Handle the modal submission
app.view('deploy_confirmation_view', async ({ ack, body, view, client }) => {
  // Get the password submitted by the user
  const password = view.state.values.deployment_password_block.deployment_password.value;
  
  // Check if the password matches
  if (password === process.env.DEPLOYMENT_PASSWORD) {
    // Password is correct, acknowledge the submission
    await ack();
    
    try {
      // Inform the channel that deployment has started
      await client.chat.postMessage({
        channel: body.user.id, // Message the user directly first
        text: "Starting deployment process..."
      });

      // Call deployment API
      await fetch(process.env.DEPLOY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-deployment-key': process.env.DEPLOYMENT_KEY,
        }
      });
      
      // Post to the channel the deployment was initiated from
      const channelId = body.view.private_metadata || 
                        (body.context ? body.context.channel_id : null);
                
      if (channelId) {
        await client.chat.postMessage({
          channel: channelId,
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
      }
    } catch (error) {
      console.error(error);
      await client.chat.postMessage({
        channel: body.user.id,
        text: `Failed to start deployment: ${error.message}`
      });
    }
  } else {
    // Password is incorrect
    await ack({
      response_action: "errors",
      errors: {
        deployment_password_block: "Incorrect password. Please try again."
      }
    });
  }
});

// Export the receiver's request handler for Vercel
module.exports = receiver.app;