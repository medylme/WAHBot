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

export class PauseAuctionCommand implements Command {
    public names = ['pauseauction'];
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
        const state = await StateUtils.getState();

        const notOngoingEmbed = new EmbedBuilder().setColor(RandomUtils.getErrorColor());
        switch (state.status) {
            case 'running':
                break;
            case 'paused':
                notOngoingEmbed
                    .setTitle('Already pausing!')
                    .setDescription('The auction is already queued to pause.');

                await InteractionUtils.send(intr, notOngoingEmbed);
                return;
            default:
                notOngoingEmbed
                    .setTitle('No ongoing auction')
                    .setDescription('There is no ongoing auction to pause.');

                await InteractionUtils.send(intr, notOngoingEmbed);
                return;
        }

        // Check if bidding is active
        if (!state.biddingActive) {
            const biddingNotActiveEmbed = new EmbedBuilder()
                .setTitle('Bidding not active')
                .setDescription(
                    'You can only pause the auction while bidding is active. This is to prevent unexpected behavior.'
                )
                .setColor(RandomUtils.getErrorColor());

            await InteractionUtils.send(intr, biddingNotActiveEmbed);
        }

        const confirmEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getSecondaryColor())
            .setTitle('Confirm')
            .setDescription('Are you sure you want to pause the auction?');

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
                            style: ButtonStyle.Primary,
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
            Logger.info(`Auction queued to pause by ${intr.user.username} (${intr.user.id})`);

            StateUtils.writeAuctionStateValues({
                status: 'pausing',
            });

            const stoppedEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('Auction pausing...')
                .setDescription('Queued the auction to pause.');

            await intr.editReply({ embeds: [stoppedEmbed], components: [] });
        } else {
            await intr.deleteReply();
            return;
        }
    }
}
