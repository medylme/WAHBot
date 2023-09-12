import { ChatInputCommandInteraction, EmbedBuilder, PermissionsString } from 'discord.js';
import { createRequire } from 'node:module';

import { HelpOption } from '../../enums/index.js';
import { Language } from '../../models/enum-helpers/index.js';
import { EventData } from '../../models/internal-models.js';
import { Lang } from '../../services/index.js';
import { InteractionUtils, RandomUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const require = createRequire(import.meta.url);
let auctionConfig = require('../../../config/tournament/config.json');

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
                let auctionDuration = auctionConfig.auctionDuration;
                let _minBid = auctionConfig.minBid;
                let _maxBid = auctionConfig.maxBid;
                let _shufflePlayers = auctionConfig.shufflePlayers;
                let _startingBalance = auctionConfig.startingBalance;

                embed = new EmbedBuilder()
                    .setColor(RandomUtils.getPrimaryColor())
                    .setAuthor({
                        name: 'WAH Help',
                    })
                    .setTitle('Auctions').setDescription(`# Welcome to Waffle's Auction House! 
                    
First off, **please check if you are properly registered in the bot using the \`/check\` command**. If there is a mistake, contact the hosts immediately.       
Furthermore, general information about the auction can be found on the [forum post](https://osu.ppy.sh/community/forums/topics/1808443?n=1).

### With that out of the way, here are some important technical details:

- Players will be auctioned off one-by-one. It will be pretty fast-paced, so make sure to keep up!
- To bid on a player, use the command \`/bid [amount]\`.
- To check your current balance, use the command \`/balance\`.
- Each player will be put on sale for ${auctionDuration} seconds, and the timer resets every time a new highest bid has been set.
- If there were no bids placed, the player goes to the free agent pool. Captains that have yet to compose a valid team can request a player from this pool by contacting one of the hosts.
- And remember: **you need one player per tier in team**, so use your balance wisely!

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
