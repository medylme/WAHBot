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

        // Check if player is captain
        const isCaptain = await StateUtils.isCaptainFromDisc(intr.user.id);
        const isProxyCaptain = await StateUtils.isProxyCaptainFromDisc(intr.user.id);

        let captainDiscId: string = intr.user.id;
        if (isProxyCaptain) {
            captainDiscId = await StateUtils.getCaptainIdFromProxyDisc(intr.user.id);
        }

        if (!isCaptain && !isProxyCaptain) {
            const notCaptainEmbed = new EmbedBuilder()
                .setTitle('Not a captain')
                .setDescription(`Only captains can bid on players.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notCaptainEmbed);
            return;
        }

        const balance = await StateUtils.GetBalance(captainDiscId);
        const balanceEmbed = new EmbedBuilder()
            .setTitle('Balance')
            .setDescription(`Your current balance is **${balance}**.`)
            .setColor(RandomUtils.getSuccessColor());
        await InteractionUtils.send(intr, balanceEmbed);
    }
}
