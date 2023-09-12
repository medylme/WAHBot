import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';
import { createRequire } from 'node:module';

import { EventData } from '../../models/internal-models.js';
import { Logger } from '../../services/index.js';
import { InteractionUtils, OsuApiUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const _require = createRequire(import.meta.url);

export class CheckCommand implements Command {
    public names = ['check'];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['ViewChannel'];
    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        const subcommandValue = intr.options.getSubcommand();

        switch (subcommandValue) {
            case 'id': {
                const query = intr.options.getInteger('value');
                const baseLog = `@${intr.user.username} (${intr.user.id}) checked id '${query}'`;

                // Check if ID exsits
                const osuUsername = await OsuApiUtils.getOsuUsername(query);
                if (osuUsername === null) {
                    const notFoundEmbed = new EmbedBuilder()
                        .setTitle('Not Found')
                        .setDescription(`An osu! account with id \`${query}\` does not exist.`)
                        .setColor(RandomUtils.getErrorColor());
                    await InteractionUtils.send(intr, notFoundEmbed);
                    Logger.info(`${baseLog} > Not found.`);
                    return;
                }

                // Captain Check
                const captainObject = await StateUtils.getCaptainStateFromOsu(query);
                if (captainObject !== null) {
                    const teamName = captainObject.teamname;

                    const captainEmbed = new EmbedBuilder()
                        .setTitle('Captain')
                        .setDescription(
                            `**${osuUsername}** (\`${query}\`) is registered as a **Captain** of Team **${teamName}**.`
                        )
                        .setColor(RandomUtils.getTertiaryColor());
                    await InteractionUtils.send(intr, captainEmbed);
                    Logger.info(`${baseLog} | Username ${osuUsername} > Captain - ${teamName}`);
                    return;
                }

                // Player Check
                const playerObject = await StateUtils.getPlayerStateFromOsu(query);
                if (playerObject !== null) {
                    const playerEmbed = new EmbedBuilder()
                        .setTitle('Player')
                        .setDescription(
                            `**${osuUsername}** (\`${query}\`) is registered as a **Player** in **Tier ${playerObject.tier}**.`
                        )
                        .setColor(RandomUtils.getPrimaryColor());
                    await InteractionUtils.send(intr, playerEmbed);
                    Logger.info(
                        `${baseLog} | Username '${osuUsername}' > Player - Tier ${playerObject.tier}`
                    );
                    return;
                }

                // Not Registered
                const notRegisteredEmbed = new EmbedBuilder()
                    .setTitle('Not Registered')
                    .setDescription(
                        `**${osuUsername}** (\`${query}\`) is currently not registered in the bot. If this is a mistake, please contact one of the hosts as soon as possible!`
                    )
                    .setColor(RandomUtils.getSecondaryColor());
                await InteractionUtils.send(intr, notRegisteredEmbed);
                Logger.info(`${baseLog} | Username '${osuUsername}' > Not registered.`);
                return;
            }
            case 'username': {
                const query = intr.options.getString('value');
                const baseLog = `@${intr.user.username} (${intr.user.id}) checked Username '${query}'`;

                // Check if username exists
                const osuId = await OsuApiUtils.getOsuId(query);
                if (osuId === null) {
                    const notFoundEmbed = new EmbedBuilder()
                        .setTitle('Not Found')
                        .setDescription(
                            `An osu! account with the username \`${query}\` does not exist.`
                        )
                        .setColor(RandomUtils.getErrorColor());
                    await InteractionUtils.send(intr, notFoundEmbed);
                    Logger.info(`${baseLog} > Not found.`);
                    return;
                }

                // Get osu! username
                const osuUsername = await OsuApiUtils.getOsuUsername(osuId);

                // Captain Check
                const captainObject = await StateUtils.getCaptainStateFromOsu(query);
                if (captainObject !== null) {
                    const teamName = captainObject.teamname;

                    const captainEmbed = new EmbedBuilder()
                        .setTitle('Captain')
                        .setDescription(
                            `**${osuUsername}** (\`${osuId}\`) is registered as a **Captain** of **${teamName}**.`
                        )
                        .setColor(RandomUtils.getTertiaryColor());
                    await InteractionUtils.send(intr, captainEmbed);
                    Logger.info(`${baseLog} | id '${osuId}' > Captain - ${teamName}`);
                    return;
                }

                // Player Check
                const playerObject = await StateUtils.getPlayerStateFromOsu(query);
                if (playerObject !== null) {
                    const playerEmbed = new EmbedBuilder()
                        .setTitle('Player')
                        .setDescription(
                            `**${osuUsername}** (\`${osuId}\`) is registered as a **Player** in **Tier ${playerObject.tier}**.`
                        )
                        .setColor(RandomUtils.getPrimaryColor());
                    await InteractionUtils.send(intr, playerEmbed);
                    Logger.info(`${baseLog} | id '${osuId}' > Player - Tier ${playerObject.tier}`);
                    return;
                }

                // Not Registered
                const notRegisteredEmbed = new EmbedBuilder()
                    .setTitle('Not Registered')
                    .setDescription(
                        `**${osuUsername}** (\`${osuId}\`) is currently not registered in the bot. If this is a mistake, please contact one of the hosts as soon as possible!`
                    )
                    .setColor(RandomUtils.getSecondaryColor());
                await InteractionUtils.send(intr, notRegisteredEmbed);
                Logger.info(`${baseLog} | id '${osuId}' > Not registered.`);
                return;
            }
            default: {
                let noCommandEmbed = new EmbedBuilder()
                    .setTitle('Not a valid command')
                    .setDescription(`Please specify a valid command.`)
                    .setColor(RandomUtils.getErrorColor());
                await InteractionUtils.send(intr, noCommandEmbed);
                return;
            }
        }
    }
}
