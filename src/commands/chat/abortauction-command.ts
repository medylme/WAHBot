import {
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder,
    PermissionsString,
} from 'discord.js';
// eslint-disable-next-line import/no-extraneous-dependencies
import { CollectorUtils } from 'discord.js-collector-utils';
import { RateLimiter } from 'discord.js-rate-limiter';

import { EventData } from '../../models/internal-models.js';
import { Logger } from '../../services/logger.js';
import { InteractionUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class AbortAuctionCommand implements Command {
    public names = ['abortauction'];
    public cooldown = new RateLimiter(1, 5000);
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [
        'ManageChannels',
        'ViewChannel',
        'SendMessages',
        'ReadMessageHistory',
        'CreatePublicThreads',
        'ManageThreads',
    ];

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        if ((await StateUtils.getStatus()) !== 'running') {
            const notOngoingEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getErrorColor())
                .setTitle('No ongoing auction')
                .setDescription('There is no ongoing auction to abort.');

            await InteractionUtils.send(intr, notOngoingEmbed);
            return;
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getDangerColor())
            .setTitle('Confirm')
            .setDescription('Are you sure you want to abort the auction?');

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
            Logger.info(`Auction queued to abort by ${intr.user.tag} (${intr.user.id})`);

            StateUtils.writeAuctionStateValues({
                status: 'aborting',
            });

            const stoppedEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getDangerColor())
                .setTitle('Auction aborting...')
                .setDescription('Aborting auction safely...');

            await intr.editReply({ embeds: [stoppedEmbed], components: [] });
        } else {
            await intr.deleteReply();
            return;
        }
    }
}
