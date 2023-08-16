# WAH 2023 - WAHBot

Discord Bot for the [WAH 2023 osu! tourney](https://osu.ppy.sh/community/forums/topics/1808443?n=1). (Mainly) handles the auction system.

## Package Commands
### Main
- `start`: Build and start the bot.
- `build`: Build the project using TypeScript.
- `lint`: Find possible linting errors using ESLint.
- `lint:fix`: Automatically fix any possible linting errors using ESLint.
- `format`: Check code formatting using Prettier.
- `format:fix`: Automatically fix code formatting issues using Prettier.
- `clean`: Clean up project files, excluding '/config/**/*'.
- `clean:dry`: Preview files that would be cleaned, excluding '/config/**/*'.
  
### Discord
- `commands:view`: View the currently registered slash commands.
- `commands:register`: Update the registered slash commands.
- `commands:rename`: Rename a registered slash command.
- `commands:delete`: Delete a registered slash command.
- `commands:clear`: Clear all registered slash commands.
