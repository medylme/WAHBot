import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsString,
    TextChannel,
} from 'discord.js';
import { createRequire } from 'node:module';

import { EventData } from '../../models/internal-models.js';
import { ClientUtils, InteractionUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const _require = createRequire(import.meta.url);
const AuctionConfig = _require('../../../config/tournament/config.json');

export class BidCommand implements Command {
    public names = ['bid'];
    public deferType = CommandDeferType.HIDDEN;
    public requireClientPerms: PermissionsString[] = ['ViewChannel'];
    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        const bidAmount = intr.options.getInteger('amount');

        const state = await StateUtils.getState();
        const currentThreadId = state.currentThreadId;
        const currentThread = (await ClientUtils.getChannel(
            intr.client,
            currentThreadId
        )) as TextChannel;

        // Check if player is captain
        const isCaptain = await StateUtils.isCaptainFromDisc(intr.user.id);
        if (!isCaptain) {
            const notCaptainEmbed = new EmbedBuilder()
                .setTitle('Not captain')
                .setDescription(`Only captains can bid on players.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notCaptainEmbed);
            return;
        }

        // Check if an auction is currently running
        if (state.status === 'idle') {
            const notOngoingEmbed = new EmbedBuilder()
                .setTitle('No ongoing auction (yet)')
                .setDescription(`There is currently no auction running.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notOngoingEmbed);
            return;
        }

        // Check if bidding is open
        if (!state.biddingActive) {
            const biddingNotActiveEmbed = new EmbedBuilder()
                .setTitle('Bidding not active')
                .setDescription(`Bidding is currently not active.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, biddingNotActiveEmbed);
            return;
        }

        // Check if team is already full
        const maxTeamSize = AuctionConfig.maxTeamSize;
        const currentTeam = await StateUtils.GetTeamMembers(intr.user.id);
        if (currentTeam.length >= maxTeamSize) {
            const teamFullEmbed = new EmbedBuilder()
                .setTitle('Team already full!')
                .setDescription(
                    `Your team is already full (${maxTeamSize} players)! You cannot bid on any more players.`
                )
                .setColor(RandomUtils.getDangerColor());
            await InteractionUtils.send(intr, teamFullEmbed);
            return;
        }

        // Check if captain has balance to bid
        const captainState = await StateUtils.getCaptainStateFromDisc(intr.user.id);
        const captainBalance = captainState.balance;
        if (bidAmount > captainBalance) {
            const notEnoughBalanceEmbed = new EmbedBuilder()
                .setTitle('Not enough balance')
                .setDescription(
                    `Unfortunately, you do not have enough balance to place a bid of **${bidAmount}** (your current balance is **${captainBalance}**).`
                )
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notEnoughBalanceEmbed);
            return;
        }

        // Check if bid is higher than min bid
        if (bidAmount < AuctionConfig.minBid) {
            const minBidNotReachedEmbed = new EmbedBuilder()
                .setTitle('Min bid not reached')
                .setDescription(`You cannot place a bid lower than **${AuctionConfig.minBid}**.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, minBidNotReachedEmbed);
            return;
        }

        // Check if bid is lower than max bid
        if (bidAmount > AuctionConfig.maxBid) {
            const maxBidExceededEmbed = new EmbedBuilder()
                .setTitle('Max bid exceeded')
                .setDescription(`You cannot place a bid higher than **${AuctionConfig.maxBid}**.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, maxBidExceededEmbed);
            return;
        }

        // Check if bid is valid:
        // - Higher than current bid + min increment
        // - Lower than max increment
        let highestBidObject = await StateUtils.getHighestBid();
        if (highestBidObject != undefined) {
            const currentHighestBid = highestBidObject.bid;
            const currentHighestBidderId = highestBidObject.bidderId;
            const currentHighestBidderName = highestBidObject.bidderName;

            const minIncrement = AuctionConfig.minIncrement as number;
            const maxIncrement = AuctionConfig.maxIncrement as number;

            // - Lower than max increment
            const maxThreshold = currentHighestBid + maxIncrement;
            if (bidAmount > maxThreshold) {
                const maxBidExceededEmbed = new EmbedBuilder()
                    .setTitle('Max bid exceeded')
                    .setDescription(
                        `Your bid of **${bidAmount}** exceeds the max increment of **${maxIncrement}** (You need to bid **${maxThreshold}** or lower).`
                    )
                    .setColor(RandomUtils.getSecondaryColor());
                await InteractionUtils.send(intr, maxBidExceededEmbed);
                return;
            }

            // - Higher than current bid + min increment
            let minThreshold = currentHighestBid;
            if (currentHighestBid > 100) minThreshold += minIncrement; // Does not apply to first bid

            if (bidAmount < minThreshold) {
                const notHighestBidEmbed = new EmbedBuilder()
                    .setTitle('Bid too low')
                    .setDescription(
                        `Your bid of **${bidAmount}** must be at least 50 higher than the current highest bid of **${currentHighestBid}** by **${
                            currentHighestBidderId == intr.user.id
                                ? 'you'
                                : currentHighestBidderName
                        }**.`
                    );

                await InteractionUtils.send(intr, notHighestBidEmbed);
                return;
            }
        }

        // Set new highest bid
        StateUtils.setHighestBid(intr.user.id, bidAmount);

        // Send new highest bid message in thread
        highestBidObject = await StateUtils.getHighestBid();
        const highestBidEmbed = new EmbedBuilder()
            .setTitle('New highest bid!')
            .setDescription(
                `**${
                    highestBidObject.bidderName
                }** (${intr.user.toString()}) has set a new highest bid of **${bidAmount}**! \nTimer has been reset.`
            )
            .setColor(RandomUtils.getTertiaryColor());
        await currentThread.send({ embeds: [highestBidEmbed] });

        // Reset bid timer
        const timeRemaining = await StateUtils.getTimeRemaining();
        const resetDuration = AuctionConfig.resetDuration as number;

        if (timeRemaining < resetDuration) {
            StateUtils.writeAuctionStateValues({
                timeRemaining: resetDuration,
            });
        }

        await intr.deleteReply();
    }
}
