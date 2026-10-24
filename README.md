# roblox-badge-tracker

A simple discord bot to track games and their badges

# Setup

## Create and add the bot to the guild

Create a bot on the [Discord Developer Portal](https://discord.com/developers/applications/)

The bot requires the `Send Messages` and `View Channels` permission for the channel you wish to use it in. No additional permissions are required.

## Configure Secrets

Next, the following values must be placed into a `.env` file:

- `API_KEY` - [an Roblox API key](https://create.roblox.com/dashboard/credentials) provisioned to be used - requires no permissions
- `BOT_TOKEN` - the [token of the discord bot](https://discord.com/developers/applications/)
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
node out/index.js
```

and you should see the bot come online!

## Stopping

To stop, you can do `Ctrl+C`, `Ctrl+D`, or `q`. Before stopping, data will be saved. On the next start, tracking will resume from the saved state.

Saves happen automatically every 5 minutes, but you can use `s` to manually save.

# Usage

## `/setup`

Set up the configuration for the bot (all configuration is listed below.)
Running without any arguments (`/setup`) will launch an **interactive menu which walks through each setting - this is recommended for first setup**.
If you want to quickly update one of the configurations without going through each setting, you can use the optional arguments - for example: `/setup log-channel:#log`

**Make sure you set the log-channel or no updates will be logged!**

### Log Channel
The channel to log updates in

### First Award Notification
The users/roles mentioned when a tracked badge receives its first award

### Updated Notification
The users/roles mentioned when a tracked game or badge is updated

### New Badge Notification
The users/roles mentioned when a tracked game has a new badge added

## `/tracking games`

Logs all the games being tracked.

## `/tracking badges`

Logs all the badges being tracked.

## `/award-history (link)`

Displays a graph of awarded over time for all tracked badges or an optional specific tracked badge.

## `/track game [link] (max-awarded)`

Tracks a specific game's badges.

`max-awarded` can be specified to filter the maximum awarded count to include. Set to `-1` to include all badges from a game.
If not specified, defaults to 100. As an example, if `max-awarded` is 1000, only badges with 1000 or less awards would be tracked.
This only applies to the initial scan - any new badges will be included regardless.

## `/track badge [link]`

Tracks a specific badge.

## `/untrack game [link]`

Stops tracking a game. Note that this will untrack any badges under this game.

## `/untrack badge [link]`

Stops tracking a badge.

# License

The license can be found in [`LICENSE`](./LICENSE)

# Contributing

If you find any bugs or make a new feature, feel free to make a pull request!
