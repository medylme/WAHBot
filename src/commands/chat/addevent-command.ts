import {
    ButtonStyle,
    ChatInputCommandInteraction,
    ComponentType,
    EmbedBuilder,
    PermissionsString,
} from 'discord.js';
import { CollectorUtils } from 'discord.js-collector-utils';
import { createRequire } from 'node:module';

import { EventData } from '../../models/internal-models.js';
import { Logger } from '../../services/index.js';
import { InteractionUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const _require = createRequire(import.meta.url);

export class AddEventCommand implements Command {
    public names = ['addevent'];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        const event = intr.options.getString('event');

        // Check if auction is ongoing
        if ((await StateUtils.getStatus()) !== 'running') {
            const notOngoingEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getErrorColor())
                .setTitle('No ongoing auction')
                .setDescription('There is no ongoing auction to abort.');

            await InteractionUtils.send(intr, notOngoingEmbed);
            return;
        }

        // Ask user for confirmation
        const confirmEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getTertiaryColor())
            .setTitle('Confirm')
            .setDescription(
                'Are you sure you want to add this event to the event log? This can currently not be undone!'
            )
            .addFields([
                {
                    name: 'Event',
                    value: event,
                },
            ]);

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
            await StateUtils.addEvent(event);

            const successEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('Added!')
                .setDescription(`Added the event to the event log.`);
            await intr.editReply({ embeds: [successEmbed], components: [] });
            Logger.info(`User '${intr.user.tag}' (${intr.user.id}) added an event: '${event}'`);
        } else {
            await intr.deleteReply();
            return;
        }
    }
}
