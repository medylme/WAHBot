import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { EventData } from '../../models/internal-models.js';
import { InteractionUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class CurrentTeamCommand implements Command {
    public names = ['currentteam'];
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
        let proxyFooterText: string;
        if (isProxyCaptain) {
            captainDiscId = await StateUtils.getCaptainIdFromProxyDisc(intr.user.id);
            const captainObject = await StateUtils.getCaptainStateFromDisc(captainDiscId);
            const captainName = captainObject.name;
            proxyFooterText = `You are acting on behalf of ${captainName} as a proxy.`;
        }

        if (!isCaptain && !isProxyCaptain) {
            const notCaptainEmbed = new EmbedBuilder()
                .setTitle('Not a captain')
                .setDescription(`Only captains (or their proxy) can check their current team.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notCaptainEmbed);
            return;
        }

        const captainState = await StateUtils.getCaptainStateFromDisc(captainDiscId);
        const teamMembersArray = captainState.teammembers;

        if (teamMembersArray.length === 0) {
            const noTeamEmbed = new EmbedBuilder()
                .setTitle('No team')
                .setDescription(`You have no players on your team yet.`)
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                noTeamEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, noTeamEmbed);
            return;
        }

        const currentTeamEmbed = new EmbedBuilder()
            .setTitle('Current Team')
            .setDescription(`Your current team consists of the following members:`)
            .setColor(RandomUtils.getPrimaryColor())
            .addFields({
                name: `Team **'${captainState.teamname}'** *(${captainState.teamvalue})*`,
                value: `${captainState.name} **(C)**\n${captainState.teammembers
                    .map(player => `${player.name} [Tier ${player.tier}] *(${player.cost})*`)
                    .join('\n')}`,
                inline: true,
            });

        if (isProxyCaptain) {
            currentTeamEmbed.setFooter({
                text: proxyFooterText,
            });
        }

        await InteractionUtils.send(intr, currentTeamEmbed);
    }
}
