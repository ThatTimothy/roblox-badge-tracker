# roblox-badge-tracker

A simple discord bot to track games and their badges

# Setup

## Create and add the bot to the guild

Create a bot on the [Discord Developer Portal](https://discord.com/developers/applications/)

The bot requires the `Send Messages` and `View Channels` permission for the channel you wish to use it in. No additional permissions are required.

## Configure Secrets

Next, the following values must be placed into a `.env` file:

- `ROBLOSECURITY` - the ROBLOSECURITY cookie of the account to be used to fetch badge information
- `BOT_TOKEN` - the token of the discord bot
- `CLIENT_ID` - the id of the bot's user client (also known as "Application Id" on the discord developers portal)
- `GUILD_ID` - the id of the guild to push commands to when registering commands (should match the server you added the bot to)

## Register Commands

Before running the bot, you must register the commands the bot will use. This is in a separate script so as to not hit discord rate limits for command updating.

```sh
npm run build
npm run register-commands
```

Once doing so, you should be able to do `/` into the chat and see the commands pop up from your bot

## Running

To run, simply do

```sh
npm run build
npm start
```

and you should see the bot come online!

# Usage

## `/log-channel`

Sets the channel to log updates to.

**Make sure you set this or no updates will be logged!**

## `/tracking games`

Logs all the games being tracked.

## `/tracking badges`

Logs all the badges being tracked.

## `/track game [link] (max-awarded)`

Tracks a specific game's badges.

`max-awarded` can be specified to filter the maximum awarded count to include. Set to `-1` to include all badges from a game.
If not specified, defaults to 100. As an example, if `max-awarded` is 1000, only badges with 1000 or less awards would be tracked.

## `/track badge [link]`

Tracks a specific badge.

## `/untrack game [link]`

Stops tracking a game. Note that this will untrack any badges under this game.

## `/untrack badge [link]`

Stops tracking a badge.
