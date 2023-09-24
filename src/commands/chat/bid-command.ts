import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsString,
    TextChannel,
} from 'discord.js';

import { EventData } from '../../models/internal-models.js';
import {
    ClientUtils,
    InteractionUtils,
    RandomUtils,
    StateUtils,
    TournamentConfigUtils,
} from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const AuctionConfig = await TournamentConfigUtils.getAuctionConfig();

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
                .setDescription(`Only captains (or their proxy) can bid on players.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notCaptainEmbed);
            return;
        }

        // Check if an auction is currently running
        if (state.status === 'idle') {
            const notOngoingEmbed = new EmbedBuilder()
                .setTitle('No ongoing auction')
                .setDescription(`There is currently no auction running.`)
                .setColor(RandomUtils.getSecondaryColor());
            await InteractionUtils.send(intr, notOngoingEmbed);
            return;
        }

        // Check if bidding is open
        if (!state.biddingActive) {
            const biddingNotActiveEmbed = new EmbedBuilder()
                .setTitle('Bidding not active')
                .setDescription(`No player is currently being sold.`)
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                biddingNotActiveEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, biddingNotActiveEmbed);
            return;
        }

        // Check if team is already full
        const maxTeamSize = AuctionConfig.maxTeamSize;
        const currentTeam = await StateUtils.GetTeamMembers(captainDiscId);
        if (currentTeam.length >= maxTeamSize - 1) {
            const teamFullEmbed = new EmbedBuilder()
                .setTitle('Team already full')
                .setDescription(
                    `Your team is already full (${maxTeamSize} players)! You cannot get any more players through the auction.`
                )
                .setColor(RandomUtils.getDangerColor());

            if (isProxyCaptain) {
                teamFullEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, teamFullEmbed);
            return;
        }

        // Check if bid is higher than min cap
        if (bidAmount < AuctionConfig.minBid) {
            const minBidNotReachedEmbed = new EmbedBuilder()
                .setTitle('Mininum bid not reached')
                .setDescription(
                    `You cannot place **any** bid lower than **${AuctionConfig.minBid}**.`
                )
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                minBidNotReachedEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, minBidNotReachedEmbed);
            return;
        }

        // Check if bid is lower than max cap
        if (bidAmount > AuctionConfig.maxBid) {
            const maxBidExceededEmbed = new EmbedBuilder()
                .setTitle('Maximum bid exceeded')
                .setDescription(`Bids are hard-capped at **${AuctionConfig.maxBid}**.`)
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                maxBidExceededEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, maxBidExceededEmbed);
            return;
        }

        // Check if captain is not already the highest bidder
        const currentHighestBidObject = await StateUtils.getHighestBidObject();
        if (currentHighestBidObject !== undefined) {
            if (currentHighestBidObject.bidderId === captainDiscId) {
                const alreadyHighestBidderEmbed = new EmbedBuilder()
                    .setTitle('Already highest bidder')
                    .setDescription(
                        `You are already the highest bidder with a bid of **${currentHighestBidObject.bid}**.`
                    )
                    .setColor(RandomUtils.getSecondaryColor());

                if (isProxyCaptain) {
                    alreadyHighestBidderEmbed.setFooter({
                        text: proxyFooterText,
                    });
                }

                await InteractionUtils.send(intr, alreadyHighestBidderEmbed);
                return;
            }
        }

        // Check if captain has balance to bid
        const captainState = await StateUtils.getCaptainStateFromDisc(captainDiscId);
        const captainBalance = captainState.balance;
        if (bidAmount > captainBalance) {
            const notEnoughBalanceEmbed = new EmbedBuilder()
                .setTitle('Not enough balance')
                .setDescription(
                    `Unfortunately, you do not have enough balance to place a bid of **${bidAmount}** (your current balance is **${captainBalance}**).`
                )
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                notEnoughBalanceEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, notEnoughBalanceEmbed);
            return;
        }

        // Check if bid is in range:
        // - Higher than current bid + min increment
        // - Lower than max increment
        const currentHighestBid = await StateUtils.getHighestBid();
        const minBid = AuctionConfig.minBid;

        // - Lower bound threshold (onFly applies after initial bid)
        if (currentHighestBid > minBid) {
            const minIncrement = AuctionConfig.minBidIncrement;
            let lowerBound = currentHighestBid + minIncrement;
            if (bidAmount < lowerBound) {
                const notHighestBidEmbed = new EmbedBuilder()
                    .setTitle('Bid too low')
                    .setDescription(
                        `Your bid of **${bidAmount}** must exceed the min increment of **${minIncrement}**; You need to bid **${lowerBound}** or higher!`
                    )
                    .setColor(RandomUtils.getSecondaryColor());

                if (isProxyCaptain) {
                    notHighestBidEmbed.setFooter({
                        text: proxyFooterText,
                    });
                }

                await InteractionUtils.send(intr, notHighestBidEmbed);
                return;
            }
        }

        // - Upper bound threshold
        const maxIncrement = AuctionConfig.maxBidIncrement;
        const upperBound = currentHighestBid + maxIncrement;
        if (bidAmount > upperBound) {
            const maxBidExceededEmbed = new EmbedBuilder()
                .setTitle('Bid too high')
                .setDescription(
                    `Your bid of **${bidAmount}** exceeds the max increment of **${maxIncrement}**; You need to bid **${upperBound}** or lower!`
                )
                .setColor(RandomUtils.getSecondaryColor());

            if (isProxyCaptain) {
                maxBidExceededEmbed.setFooter({
                    text: proxyFooterText,
                });
            }

            await InteractionUtils.send(intr, maxBidExceededEmbed);
            return;
        }

        // Set new highest bid
        await StateUtils.setHighestBid(captainDiscId, bidAmount);

        const newHighestBidObject = await StateUtils.getHighestBidObject();
        const captainOsuName = newHighestBidObject.bidderName;
        const captainDiscordName = intr.user.toString();

        const newLowerBound = newHighestBidObject.bid + AuctionConfig.minBidIncrement;
        const newUpperbound = newHighestBidObject.bid + AuctionConfig.maxBidIncrement;

        let bidderIdentity = `**${captainOsuName}** (${captainDiscordName})`;
        if (isProxyCaptain) {
            const proxyName = intr.user.toString();
            bidderIdentity = `**${captainOsuName}** (Proxy: ${proxyName})`;
        }

        const highestBidEmbed = new EmbedBuilder()
            .setTitle('New highest bid!')
            .setDescription(
                `${bidderIdentity} has set a new highest bid of **${bidAmount}**! \nTimer has been reset.\n\nValid higher bids: **${newLowerBound}** - **${newUpperbound}**`
            )
            .setColor(RandomUtils.getTertiaryColor());
        await currentThread.send({ embeds: [highestBidEmbed] });

        // Reset bid timer
        const timeRemaining = await StateUtils.getTimeRemaining();
        const resetDuration = AuctionConfig.resetDuration;

        if (timeRemaining < resetDuration) {
            StateUtils.writeAuctionStateValues({
                timeRemaining: resetDuration,
            });
        }

        await intr.deleteReply();
    }
}
