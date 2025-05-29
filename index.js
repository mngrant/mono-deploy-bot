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

// Show a confirmation dialog when the deploy button is clicked
app.action('deploy_button', async ({ body, ack, client }) => {
  // Acknowledge the button click first
  await ack();
  
  try {
    const channelId = body.channel?.id || body.container?.channel_id;

    // Open a modal with password prompt, including the original message context
    await client.views.open({
      trigger_id: body.trigger_id,
      view: {
        type: "modal",
        callback_id: "deploy_confirmation_view",
        private_metadata: JSON.stringify({
          channelId: channelId,
          messageTs: body.message.ts
        }),
        title: {
          type: "plain_text",
          text: "Deployment Confirmation",
          emoji: true
        },
        submit: {
          type: "plain_text",
          text: "Deploy Now",
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
              text: ":warning: You are about to trigger a deployment. Please confirm by entering the deployment password:"
            }
          },
          {
            type: "input",
            block_id: "password_block",
            element: {
              type: "plain_text_input",
              action_id: "password_input",
              placeholder: {
                type: "plain_text",
                text: "Enter password"
              }
            },
            label: {
              type: "plain_text",
              text: "Deployment Password",
              emoji: true
            }
          }
        ]
      }
    });
  } catch (error) {
    console.error("Error opening modal:", error);
    
    // Make sure we have channel and user IDs before trying to send messages
    if (body.channel?.id && body.user?.id) {
      await client.chat.postEphemeral({
        channel: body.channel.id,
        user: body.user.id,
        text: `Error opening confirmation dialog: ${error.message}`
      });
    } else {
      console.error("Could not send error message - missing channel or user ID");
      console.error("Body:", JSON.stringify(body));
    }
  }
});

// Handle the modal submission with password verification
app.view('deploy_confirmation_view', async ({ ack, body, view, client }) => {
  // Get password from input
  const password = view.state.values.password_block.password_input.value;
  
  // Check if password matches the one in environment variables
  if (password === process.env.DEPLOYMENT_PASSWORD) {
    // Password is correct, proceed with deployment
    await ack();
    
    try {
      // Get user who submitted the modal and original message context
      const userId = body.user.id;
      let channelId, messageTs;
      try {
        const metadata = JSON.parse(view.private_metadata);
        channelId = metadata.channelId;
        messageTs = metadata.messageTs;
      } catch (e) {
        channelId = view.private_metadata || body.channel?.id || body.container?.channel_id;
      }
      
      // Call deployment API
      await fetch(process.env.DEPLOY_API_ENDPOINT, {
        method: 'POST',
        headers: {
          'x-deployment-key': process.env.DEPLOYMENT_KEY,
        }
      });
      
      // Update the original message to reflect deployment status
      if (channelId && messageTs) {
        await client.chat.update({
          channel: channelId,
          ts: messageTs,
          text: `:white_check_mark: Deployment triggered by <@${userId}>!`,
          blocks: [
            {
              type: "section",
              text: {
                type: "mrkdwn",
                text: `:white_check_mark: Deployment triggered by <@${userId}>!`
              }
            }
          ]
        });
      }
      
      // Post confirmation message in the channel
      if (channelId) {
        await client.chat.postMessage({
          channel: channelId,
          text: `Deployment triggered by <@${userId}>! :rocket:\nIt will take about 10 minutes.`,
          blocks: [
            {
              "type": "section",
              "text": {
                "type": "mrkdwn",
                "text": `:white_check_mark: Deployment triggered by <@${userId}>! :rocket:\nIt will take about 10 minutes.`
              }
            }
          ]
        });
      } else {
        // If channel ID is not available, send ephemeral message to user
        await client.chat.postEphemeral({
          channel: userId,
          user: userId,
          text: `:white_check_mark: Deployment triggered! :rocket:\nIt will take about 10 minutes.`
        });
      }
    } catch (error) {
      console.error(error);
      await client.chat.postEphemeral({
        channel: body.user.id,
        user: body.user.id,
        text: `Failed to start deployment: ${error.message}`
      });
    }
  } else {
    // Password is incorrect
    await ack({
      response_action: "errors",
      errors: {
        password_block: "Invalid deployment password. Please try again."
      }
    });
  }
});

// Export the receiver's request handler for Vercel
module.exports = receiver.app;