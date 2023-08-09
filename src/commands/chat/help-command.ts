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
                let minBid = auctionConfig.minBid;
                let maxBid = auctionConfig.maxBid;
                let shufflePlayers = auctionConfig.shufflePlayers;
                let startingBalance = auctionConfig.startingBalance;

                embed = new EmbedBuilder()
                    .setColor(RandomUtils.getPrimaryColor())
                    .setAuthor({
                        name: 'WAH Help',
                    })
                    .setTitle('Auctions')
                    .setDescription(`Welcome to Waffle's Auction House! Here are the rules:

                    - Players will be auctioned off one-by-one.
                    - There are four tiers of players, with tier 4 representing the lowest seed and tier 1 the highest.
                    - Auctions will be grouped by tier${
                        shufflePlayers
                            ? ', but players are shuffled within their respective tier'
                            : ''
                    }. The bot will show how many players are left during the auction.
                    - Each player will be put on sale for ${auctionDuration} seconds, and the timer resets every time a new highest bid has been set.
                    - If there were no bids placed, the player goes to a free agent pool. Captains that have yet to compose a valid team can request a player from this pool, free of charge (contact one of the hosts for this).
                    - A valid team consists of one player from each tier, with a maximum of ten players.

                    - You start with ${startingBalance} balance.
                    - The starting bid for each player is ${minBid}.
                    - You cannot bid more than ${maxBid} on a player.
                    - Your bid has to be at least 50 more than the current highest bid.
                    - To bid on a player, use the command \`/bid [amount]\`.
                    - To check your current balance, use the command \`/balance\`.

                    If you win, the amount will be deducted from your balance. If not, you will not be charged. And remember: **you need one player per tier in your team**!

                    If you have any other questions, feel free to ask the hosts!
                    
                    GLHF!`);
                break;
            }
            default: {
                return;
            }
        }

        await InteractionUtils.send(intr, embed);
    }
}
