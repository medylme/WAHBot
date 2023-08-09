import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { EventData } from '../../models/internal-models.js';
import { InteractionUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class BalanceCommand implements Command {
    public names = ['balance', 'bal'];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = [];
    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        if ((await StateUtils.getStatus()) !== 'running') {
            const notOngoingEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getErrorColor())
                .setTitle('No ongoing auction (yet)')
                .setDescription('what are you checking your balance for bro');

            await InteractionUtils.send(intr, notOngoingEmbed);
            return;
        }

        // Check if user is captain
        const isCaptain = StateUtils.isCaptain(intr.user.id);

        if (!isCaptain) {
            const notCaptainEmbed = new EmbedBuilder()
                .setTitle('Not captain')
                .setDescription(
                    `You are currently not listed as a captain. If you believe this is a mistake, please contact the hosts.`
                )
                .setColor(RandomUtils.getDangerColor());
            await InteractionUtils.send(intr, notCaptainEmbed);
            return;
        }

        const balance = await StateUtils.GetBalance(intr.user.id);
        const balanceEmbed = new EmbedBuilder()
            .setTitle('Balance')
            .setDescription(`Your current balance is **${balance}** points.`)
            .setColor(RandomUtils.getSuccessColor());
        await InteractionUtils.send(intr, balanceEmbed);
    }
}
