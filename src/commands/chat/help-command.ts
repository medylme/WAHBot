import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';

import { HelpOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils, RandomUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

export class HelpCommand implements Command {
    public names = [Lang.getRef('chatCommands.help', Language.Default)];
    public deferType = CommandDeferType.PUBLIC;
    public requireClientPerms: PermissionsString[] = [];
    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        let args = {
            option: intr.options.getString(
                Lang.getRef('arguments.option', Language.Default)
            ) as HelpOption,
        };

        let embed: EmbedBuilder;
        switch (args.option) {
            case HelpOption.AUCTION: {
                embed = new EmbedBuilder()
                    .setColor(RandomUtils.getPrimaryColor())
                    .setAuthor({
                        name: 'WaffleBot Help',
                    })
                    .setTitle('Auctions').setDescription(`# Welcome to Waffle's Auction House! 
                       
General information about the auction can be found on the [forum post](https://osu.ppy.sh/community/forums/topics/1808443?n=1).
All the technical details can be found in [this document](https://docs.google.com/document/d/1KwYlh1Ng0ft3MN_dh7kbiYEn84IG9fdUdcO5hCHuLpc).

If you have any other questions, feel free to ask the hosts!

GLHF! - dyl <3`);
                break;
            }
            default: {
                return;
            }
        }

        await InteractionUtils.send(intr, embed);
    }
}
