import {
    ChatInputCommandInteraction,
    EmbedBuilder,
    PermissionsString,
    TextChannel,
} from 'discord.js';
import { RateLimiter } from 'discord.js-rate-limiter';
import fetch from 'node-fetch';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import util from 'node:util';

import { EventData } from '../../models/internal-models.js';
import { Logger } from '../../services/logger.js';
import { InteractionUtils, OpenAIUtils, RandomUtils, StateUtils } from '../../utils/index.js';
import { AuctionStats, PlayersList, ResumeData } from '../../utils/state-utils.js';
import { Command, CommandDeferType } from '../index.js';

const writeFileAsync = util.promisify(fs.writeFile);

async function writeToFile(
    filename: fs.PathOrFileDescriptor,
    data: string | NodeJS.ArrayBufferView
): Promise<void> {
    try {
        await writeFileAsync(filename, data);
        Logger.debug(`Data written to ${filename}`, data);
    } catch (error) {
        Logger.error(`Error writing data to ${filename}: ${error}`);
    }
}

const require = createRequire(import.meta.url);
let AuctionConfig = require('../../../config/tournament/config.json');

function delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class StartAuctionCommand implements Command {
    public names = ['startauction'];
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
        const channel: TextChannel = intr.channel as TextChannel;
        let pauseData: ResumeData = {
            auctionState: undefined,
            auctionStats: undefined,
            currentPlayerIndex: undefined,
            captains: undefined,
            shuffledPlayers: {
                1: undefined,
                2: undefined,
                3: undefined,
                4: undefined,
            },
        };

        // Load Configs
        let PlayersData: PlayersList = require('../../../config/tournament/players.json');
        const auctionDuration: number = AuctionConfig.auctionDuration;
        const auctionChannel = (await channel.guild.channels.fetch(channel.id)) as TextChannel;

        // Check if auction is already ongoing
        const auctionStatus = await StateUtils.getStatus();
        const responseEmbed = new EmbedBuilder();
        switch (auctionStatus) {
            case 'running':
                responseEmbed
                    .setColor(RandomUtils.getSecondaryColor())
                    .setTitle('Auction already ongoing!')
                    .setDescription('There is already an ongoing auction!');

                await InteractionUtils.send(intr, responseEmbed);
                return;
            case 'aborting':
                responseEmbed
                    .setColor(RandomUtils.getSecondaryColor())
                    .setTitle('Auction aborting!')
                    .setDescription(
                        'An ongoing auction is currently aborting! Please wait until it is finished.'
                    );

                await InteractionUtils.send(intr, responseEmbed);
                return;
            case 'pausing':
                responseEmbed
                    .setColor(RandomUtils.getSecondaryColor())
                    .setTitle('Auction pausing!')
                    .setDescription(
                        'An ongoing auction is currently pausing! Please wait until it is finished.'
                    );

                await InteractionUtils.send(intr, responseEmbed);
                return;
            default:
                responseEmbed
                    .setColor(RandomUtils.getSuccessColor())
                    .setTitle('Auction starting!')
                    .setDescription(`Starting auction in ${auctionChannel.toString()}.`);

                await InteractionUtils.send(intr, responseEmbed);
                break;
        }

        Logger.info(`Auction started by ${intr.user.tag} (${intr.user.id})`);

        let playerAmount = 0;
        let shuffledPlayers: PlayersList;
        let currentPlayerIndex = 0;
        let initialTierIndex = 0;

        const startingAnnouncementEmbed = new EmbedBuilder();
        let resuming = fs.existsSync('./config/tournament/paused.json');
        // Check if a paused.json file exists in the tournament folder
        if (resuming) {
            let PausedStateFile = require('../../../config/tournament/paused.json');
            try {
                const resumeData = PausedStateFile as ResumeData;
                Logger.info(`'resume.json' found, resuming auction from file...`);

                initialTierIndex = resumeData.auctionState.currentTierIndex;
                shuffledPlayers = resumeData.shuffledPlayers;
                for (const key in shuffledPlayers) {
                    PlayersData[key] = shuffledPlayers[key];
                }
                currentPlayerIndex = resumeData.currentPlayerIndex;
                resumeData.auctionState.status = 'running';
                await StateUtils.ResumeAuction(resumeData);

                startingAnnouncementEmbed
                    .setColor(RandomUtils.getPrimaryColor())
                    .setTitle('Auction resuming.')
                    .setDescription('The auction will be resumed shortly!');
            } catch (e) {
                Logger.error(`Error reading resume file, please check or delete the file.`, e);
                return;
            }
        } else {
            startingAnnouncementEmbed
                .setColor(RandomUtils.getPrimaryColor())
                .setTitle('Auction starting!')
                .setDescription(
                    'The auction will be starting shortly, \n\n**Captains:** Make sure you have read `/help auction`!'
                );

            await StateUtils.resetAuctionStateValues();
            playerAmount = 0;
            for (let i = 0; i < AuctionConfig.tierOrder.length; i++) {
                playerAmount += PlayersData[AuctionConfig.tierOrder[i]].length;
            }
            await StateUtils.writeAuctionStateValues({
                status: 'running',
                totalPlayers: playerAmount,
            });

            // Shuffle players in each tier
            for (let i = 0; i < AuctionConfig.tierOrder.length; i++) {
                const tier = AuctionConfig.tierOrder[i];
                PlayersData[tier] = RandomUtils.shuffle(PlayersData[tier]);
            }
        }

        await intr.channel.send({ embeds: [startingAnnouncementEmbed] });

        // Wait 5 seconds
        await delay(10000);

        const tierOrder = AuctionConfig.tierOrder;
        for (let i = initialTierIndex; i < tierOrder.length; i++) {
            const currentTier = tierOrder[i];

            StateUtils.writeAuctionStateValues({
                currentTierIndex: i,
            });

            if ((await StateUtils.getStatus()) === 'aborting') {
                break;
            } else if ((await StateUtils.getStatus()) === 'pausing') {
                break;
            }

            Logger.info(`Auctioning tier ${currentTier} players...`);

            const NextTierEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getTertiaryColor())
                .setAuthor({
                    name: i === 0 ? 'First up!' : `Next up!`,
                })
                .setTitle(`Tier ${currentTier} players!`);
            await auctionChannel.send({ embeds: [NextTierEmbed] });

            let playerList = PlayersData[currentTier];
            // Shuffle players
            if (AuctionConfig.shufflePlayers) {
                playerList = playerList.sort(() => Math.random() - 0.5);
                Logger.info(`Tier ${currentTier} Order (Shuffled):`, playerList);
            } else {
                Logger.info(`Tier ${currentTier} Order (Not Shuffled):`, playerList);
            }

            await delay(5000);

            // Auction every player in each tier
            for (let i = resuming ? currentPlayerIndex : 0; i < playerList.length; i++) {
                const currentPlayerId = playerList[i];

                // Get player info
                const apiLink = `https://osu.ppy.sh/api/get_user?k=${AuctionConfig.apiKey}&u=${currentPlayerId}&m=0&type=id`;
                const apiResponse = await fetch(apiLink);
                const playerObject: unknown = await apiResponse.json();
                const username = playerObject[0].username;
                const rank = playerObject[0].pp_rank;

                // Reset states
                await StateUtils.writeAuctionStateValues({
                    currentPlayer: currentPlayerId,
                    currentPlayerName: username,
                    highestBid: undefined,
                    highestBidderId: undefined,
                });

                pauseData.currentPlayerIndex = i;

                if ((await StateUtils.getStatus()) === 'aborting') {
                    break;
                } else if ((await StateUtils.getStatus()) === 'pausing') {
                    break;
                }

                Logger.info(`Auctioning player id ${currentPlayerId}...`);

                // Create thread
                const thread = await auctionChannel.threads.create({
                    name: `Tier ${currentTier} | #${i + 1}: ${username}`,
                    autoArchiveDuration: 1440,
                    reason: 'Auctioning a player',
                });
                thread.setLocked(true);
                StateUtils.writeAuctionStateValues({
                    currentThreadId: thread.id,
                });

                let nextUpEmbedDesc: string;
                if (i === 0) {
                    nextUpEmbedDesc = 'First up!';
                } else {
                    nextUpEmbedDesc = 'Next up...';
                }
                const nextUpEmbed = new EmbedBuilder()
                    .setColor(RandomUtils.getPrimaryColor())
                    .setTitle(username)
                    .setDescription('Bidding starts in 10 seconds!')
                    .setURL(`https://osu.ppy.sh/users/${currentPlayerId}`)
                    .setAuthor({
                        name: `${nextUpEmbedDesc}`,
                    })
                    .setImage(`https://s.ppy.sh/a/${currentPlayerId}`)
                    .addFields([
                        {
                            name: 'Seeded Tier',
                            value: `${currentTier}`,
                            inline: true,
                        },
                        {
                            name: 'Current Rank',
                            value: `#${rank}`,
                            inline: true,
                        },
                    ]);
                await thread.send({ embeds: [nextUpEmbed] });

                // Wait 10 seconds, and then open bidding
                await delay(10000);

                await StateUtils.writeAuctionStateValues({
                    biddingActive: true,
                    timeRemaining: auctionDuration,
                });
                thread.setLocked(false);

                // Announce in thread
                const bidsOpenEmbed = new EmbedBuilder()
                    .setColor(RandomUtils.getSuccessColor())
                    .setTitle(`Bids are open!`)
                    .addFields({
                        name: 'Starting bid',
                        value: `${AuctionConfig.minBid}`,
                        inline: true,
                    });
                await thread.send({ embeds: [bidsOpenEmbed] });

                // Announce in main channel
                const mainChannelMessage = await auctionChannel.send(
                    `Bidding for **${username}** has started! \nTime remaining: **${auctionDuration}** seconds!`
                );

                const waitForEnd = new Promise<void>(resolve => {
                    const interval = setInterval(async () => {
                        // Check if auction has been aborted
                        if ((await StateUtils.getStatus()) === 'aborting') {
                            clearInterval(interval);
                            resolve();
                            return;
                        }

                        // Check if auction has ended
                        const timeRemaining = await StateUtils.getTimeRemaining();
                        if (timeRemaining <= 0) {
                            clearInterval(interval);
                            resolve();
                            return;
                        }

                        // Update time remaining in thread
                        await mainChannelMessage.edit(
                            `Bidding for **${username}** has started! \nTime remaining: **${timeRemaining}** seconds!`
                        );

                        // Decrement time remaining in state
                        await StateUtils.writeAuctionStateValues({
                            timeRemaining: (await StateUtils.getTimeRemaining()) - 1,
                        });
                    }, 1000);
                });

                await waitForEnd;

                // Close bidding
                const auctionEndEmbed = new EmbedBuilder()
                    .setColor(RandomUtils.getDangerColor())
                    .setTitle(`Bids are now closed!`);
                await thread.send({ embeds: [auctionEndEmbed] });
                await thread.setLocked(true);

                await StateUtils.writeAuctionStateValues({
                    biddingActive: false,
                });

                await delay(1000);

                // Announce winner in thread and main channel
                const highestBidObject = await StateUtils.getHighestBid();
                if (highestBidObject == undefined) {
                    const noBidsEmbed = new EmbedBuilder()
                        .setColor(RandomUtils.getSecondaryColor())
                        .setTitle('No bids!')
                        .setDescription(
                            'No one bid on this player. They will be placed in the free pool.'
                        );
                    await thread.send({ embeds: [noBidsEmbed] });

                    await mainChannelMessage.edit(
                        `No one bid on this player. They will be placed in the free pool. \nThere are **${
                            playerList.length - i - 1
                        }** player(s) left in this tier (make sure you get at least one)!`
                    );
                } else {
                    // Add player to winner's team
                    StateUtils.SellPlayer();

                    const highestBid = highestBidObject.bid;
                    const highestBidder = highestBidObject.bidderName;
                    const soldThreadEmbed = new EmbedBuilder()
                        .setColor(RandomUtils.getPrimaryColor())
                        .setTitle('Sold!')
                        .setFields([
                            {
                                name: 'Sold to',
                                value: `${highestBidder}`,
                                inline: true,
                            },
                            {
                                name: 'Winning bid',
                                value: `${highestBid}`,
                                inline: true,
                            },
                        ]);
                    await thread.send({ embeds: [soldThreadEmbed] });

                    await mainChannelMessage.edit(
                        `**${username}** has been sold to **${highestBidder}** for **${highestBid}** points! \nThere are **${
                            playerList.length - i - 1
                        }** player(s) left in this tier (make sure you get at least one).`
                    );
                }

                if (i === playerList.length - 1) {
                    pauseData.currentPlayerIndex = 0;
                }

                await delay(10 * 1000);
                await thread.setArchived(true);
            }
        }

        const completionEmbed = new EmbedBuilder();
        switch (await StateUtils.getStatus()) {
            case 'pausing':
                Logger.debug('Writing pausing state...');
                pauseData.auctionState = await StateUtils.getState();
                pauseData.auctionStats = await StateUtils.GetAuctionStats();
                for (const key in PlayersData) {
                    pauseData.shuffledPlayers[key] = PlayersData[key];
                }
                pauseData.auctionState.status = 'idle';
                pauseData.captains = await StateUtils.GetAuctionResults();
                try {
                    await writeToFile('./config/tournament/paused.json', JSON.stringify(pauseData));

                    StateUtils.resetAuctionStateValues();

                    Logger.info('Auction successfully paused.');
                    completionEmbed
                        .setColor(RandomUtils.getSecondaryColor())
                        .setTitle('Auction paused.')
                        .setDescription(`The auction has been paused by an admin.`);

                    await auctionChannel.send({ embeds: [completionEmbed] });
                    return;
                } catch (e) {
                    Logger.error('Failed to write pause data to file.', e);
                    return;
                }
            case 'aborting':
                StateUtils.resetAuctionStateValues();

                Logger.info('Auction successfully aborted.');
                completionEmbed
                    .setColor(RandomUtils.getDangerColor())
                    .setTitle('Auction aborted.')
                    .setDescription(`The auction has been aborted by an admin.`);

                await auctionChannel.send({ embeds: [completionEmbed] });
                break; // only breaking for debugging purposes, change to return when done
            default:
                Logger.info('Auction completed successfully.');
                completionEmbed
                    .setColor(RandomUtils.getTertiaryColor())
                    .setTitle('Auction finished!')
                    .setDescription(`That's all folks, the auction has concluded!`);

                await auctionChannel.send({ embeds: [completionEmbed] });
                break;
        }

        const loadingMessages = [
            'Unbadging tournament...',
            'Crunching numbers faster than a pack of hungry Waffles...',
            'Staring at the amount of HDDT on that one profile... O_O',
            'Overstreaming 222BPM...',
            'They locked the refs in the basement, please help...',
            'Abusing speed meta...',
            'Betting on a deranker...',
            'Thinking about maxbetting on a deranker...',
            'Maxbetting maliszewski...',
        ];
        // Shuffle loading messages
        for (let i = loadingMessages.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [loadingMessages[i], loadingMessages[j]] = [loadingMessages[j], loadingMessages[i]];
        }
        // Cycle through loading messages
        let loadingMessagesTicker = 0;
        const cycleLoadingMessages = setInterval(async () => {
            const loadingEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('Generating report...')
                .setDescription('Grab a snack while I crunch the numbers!')
                .setFooter({
                    text: `${loadingMessages[loadingMessagesTicker]}`,
                });
            await resultsMessage.edit({ embeds: [loadingEmbed] });

            if (loadingMessagesTicker == loadingMessages.length - 1) {
                loadingMessagesTicker = 0;
            } else {
                loadingMessagesTicker++;
            }
        }, 4000);

        const resultsEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getSecondaryColor())
            .setTitle('Generating report...')
            .setDescription('Grab a snack while I crunch the numbers!')
            .setFooter({
                text: `${loadingMessages[Math.floor(Math.random() * loadingMessages.length)]}`,
            });
        const resultsMessage = await auctionChannel.send({ embeds: [resultsEmbed] });

        const resultsEmbeds = [];
        const auctionResultsEmbeds = [];
        // Calculate team results
        const auctionResults = await StateUtils.GetAuctionResults();
        let auctionResultsArray = [];
        for (const key in auctionResults) {
            auctionResultsArray.push(auctionResults[key]);
        }
        for (let i = 0; i < auctionResultsArray.length; i += 25) {
            const auctionResultsEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getPrimaryColor())
                .setTitle(i == 0 ? 'Team Results' : 'Team Results *(continued)*')
                .setDescription(`Below are the teams that were created during the auction:`)
                .addFields(
                    auctionResultsArray
                        .slice(i, i + 25)
                        .map(team => {
                            return {
                                name: team.teamname,
                                value: `${team.name} **(C)**\n${team.teammembers
                                    .map(player => `${player.name} *(${player.cost} points)*`)
                                    .join('\n')}`,
                                inline: true,
                            };
                        })
                        .filter(field => field.value != '')
                );
            auctionResultsEmbeds.push(auctionResultsEmbed);
        }
        resultsEmbeds.push(...auctionResultsEmbeds);

        // Calculate AI report
        if (AuctionConfig.AIReport) {
            const _auctionStatsObject: AuctionStats = await StateUtils.GetAuctionStats();
            const _exampleStats: AuctionStats = {
                playersSold: 32,
                totalSpent: 213234,
                totalBids: 251,
                totalPlayers: 40,
                mostValuablePlayer: 'KSN',
                mostValuablePlayerValue: 10000,
                mostValuablePlayerTier: 1,
                mostValuablePlayerTeam: 'dyls pickles',
                biggestSpender: 'dyl',
                biggestSpenderAmount: 19843,
                biggestSpenderTeam: 'dyls pickles',
            };
            const eventsList = await StateUtils.getEvents();

            try {
                const aiReport = await OpenAIUtils.GenerateReport(
                    `
                    - General:
                    We're hosting an osu! tournament called Waffle's Auction House. Captains have just finished bidding against each other to compose their team with a balance of ${
                        AuctionConfig.startingBalance
                    } points. Players are seeded in Tiers 1-4 according to their rank in osu! (Tier 1 is best). Unsold players will go to a free agent pool called "last chance pool" for captains that do not yet have one player per tier. After this, they will face off in osu!.
                    IMPORTANT: all of the above does not have to be explained!
                    You are WaffleBot, the Discord bot that has just been used to do the auction. Generate a fun presentation for the players to read. Format the message using *italics* and **bold**, and you can also use some Discord emojis.
                    - JSON explanation:
                    playerSold - The number of players sold
                    totalSpent - The total amount of money spent by all captains
                    totalBids - The total number of bids made by all captains
                    totalPlayers - The total number of players in the tournament
                    mostValuablePlayer - The player with the highest price reached
                    mostValuablePlayerValue - The value of the MVP
                    mostValuablePlayerTier - The tier of the MVP
                    mostValuablePlayerTeam - The team that the MVP ended up going to
                    biggestSpender - The captain who spent the most balance
                    biggestSpenderAmount - The amount of balance the biggest spender spent
                    biggestSpenderTeam - The team name of the biggest spender
                    ${
                        eventsList
                            ? `- Notable/funny events to be integrated in the report (but not the main focus):
                    ${eventsList.map(event => event).join('\n')}
                    `
                            : ''
                    }
                    `,
                    _exampleStats
                );
                const aiReportEmbed = new EmbedBuilder()
                    .setColor(RandomUtils.getPrimaryColor())
                    .setTitle(`WaffleBot's (Super Professional) Report`)
                    .setDescription(
                        `${aiReport}\n
                    WaffleBot out! :sunglasses:`
                    )
                    .setFooter({
                        text: `Powered by GPT-4`,
                    });
                resultsEmbeds.push(aiReportEmbed);
            } catch (e) {
                Logger.error('Failed to generate AI report.', e);
            }
        }

        clearInterval(cycleLoadingMessages);
        await resultsMessage.edit({ embeds: resultsEmbeds });

        await StateUtils.resetAuctionStateValues();
    }
}
