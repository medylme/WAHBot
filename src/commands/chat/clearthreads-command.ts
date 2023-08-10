import {
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder,
    FetchedThreads,
    PermissionsString,
    TextChannel,
} from 'discord.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { CollectorUtils } from 'discord.js-collector-utils';
import { RateLimiter } from 'discord.js-rate-limiter';

import { EventData } from '../../models/internal-models.js';
import { Logger } from '../../services/logger.js';
import { RandomUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

let AuctionConfig = require('../../config/tournament/config.json');

export class ClearThreadsCommand implements Command {
    public names = ['clearthreads'];
    public cooldown = new RateLimiter(1, 5000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['ViewChannel', 'ManageThreads'];

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        const channel: TextChannel = intr.channel as TextChannel;
        const auctionChannel = (await channel.guild.channels.fetch(channel.id)) as TextChannel;

        const confirmEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getDangerColor())
            .setTitle('Confirm?')
            .setDescription(
                'Are you sure you want to clear all auction threads in the current channel? This cannot be undone!'
            );

        let prompt = await intr.editReply({
            embeds: [confirmEmbed],
            components: [
                {
                    type: ComponentType.ActionRow,
                    components: [
                        {
                            type: ComponentType.Button,
                            customId: 'confirm',
                            label: 'Confirm',
                            style: ButtonStyle.Danger,
                        },
                        {
                            type: ComponentType.Button,
                            customId: 'cancel',
                            label: 'Cancel',
                            style: ButtonStyle.Secondary,
                        },
                    ],
                },
            ],
        });

        let result = await CollectorUtils.collectByButton(
            prompt,
            // Retrieve Result
            async buttonInteraction => {
                switch (buttonInteraction.customId) {
                    case 'confirm':
                        return { intr: buttonInteraction, value: 'confirmed' };
                    case 'cancel':
                        return { intr: buttonInteraction, value: 'cancelled' };
                    default:
                        return;
                }
            },
            // Options
            {
                time: 15000,
                reset: true,
                target: intr.user,
                stopFilter: message => message.content.toLowerCase() === 'stop',
                onExpire: async () => {
                    await intr.deleteReply();
                },
            }
        );

        if (result.value === 'cancelled') {
            await intr.deleteReply();
            return;
        } else if (result.value === 'confirmed') {
            const stoppedEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('Deleting...')
                .setDescription('Deleting all threads in the current channel...');
            await intr.editReply({ embeds: [stoppedEmbed], components: [] });

            const threadPrefix = AuctionConfig.threadPrefix;
            const activeThreads: FetchedThreads = await auctionChannel.threads.fetchActive();
            const archivedThreads: FetchedThreads = await auctionChannel.threads.fetchArchived();
            const allThreads = activeThreads.threads.concat(archivedThreads.threads);

            for (const thread of allThreads.values()) {
                // check if thread name starts with the current prefix
                if (!thread.name.toLowerCase().startsWith(threadPrefix)) {
                    continue;
                }

                await thread.delete();
            }

            Logger.info(
                `All threads in auction channel deleted by ${intr.user.tag} (${intr.user.id})`
            );

            const successEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('Done!')
                .setDescription('Deleted all threads in the current channel.');
            await intr.editReply({ embeds: [successEmbed], components: [] });
        } else {
            await intr.deleteReply();
            return;
        }
    }
}
