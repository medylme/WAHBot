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
import { PlayersList, ResumeData, TeamMembers } from '../../models/state-models.js';
import { Logger } from '../../services/logger.js';
import {
    InteractionUtils,
    OpenAIUtils,
    RandomUtils,
    StateUtils,
    TournamentConfigUtils,
} from '../../utils/index.js';
import { Command, CommandDeferType } from '../index.js';

const require = createRequire(import.meta.url);
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

const ApiKeyConfig = await TournamentConfigUtils.getApiKeysConfig();
const AuctionConfig = await TournamentConfigUtils.getAuctionConfig();

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

    private static loadingMessages = [
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
    private pauseData: ResumeData = {
        auctionState: undefined,
        auctionStats: undefined,
        freeAgents: undefined,
        currentPlayerIndex: undefined,
        captains: undefined,
        shuffledPlayers: {
            1: undefined,
            2: undefined,
            3: undefined,
            4: undefined,
        },
    };

    private async generateReport(): Promise<any[]> {
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
                .setDescription(
                    i == 0
                        ? `Below are the teams that were created during the auction. Note that these are provisional team names, meaning they can still be changed upon request of the captain!`
                        : ''
                )
                .addFields(
                    auctionResultsArray
                        .slice(i, i + 25)
                        .map(team => {
                            return {
                                name: `Team **'${team.teamname}'** *(${team.teamvalue})*`,
                                value: `${team.name} **(C)**\n${team.teammembers
                                    .map(
                                        player =>
                                            `${player.name} [Tier ${player.tier}] *(${player.cost})*`
                                    )
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
            const _auctionStatsObject = {
                Stats: await StateUtils.GetAuctionStats(),
                Captains: auctionResults,
            };
            const eventsList = await StateUtils.getEvents();

            try {
                const aiReport = await OpenAIUtils.GenerateReport(
                    `- General:
We're hosting an osu! tournament called Waffle's Auction House. Captains have just finished bidding against each other to compose their team
a balance of ${
                        AuctionConfig.startingBalance
                    } points each. Players are seeded in Tiers 1-4 according to their rank in osu! (Tier 1 is best). Unsold players will go to a free agent poo
captains that do not yet have one player per tier. After this, they will face off in osu!.
IMPORTANT: all of the above does not have to be explained!
You are WaffleBot, the Discord bot that has just been used to do the auction. Generate a fun presentation for the players to read. Forma
message using *italics* and **bold**, and you can also use SOME Discord emojis (please don't overdo it).
- JSON explanation:
playerSold - The number of players sold
totalSpent - The total amount of money spent by all captains
totalBids - The total number of bids made by all captains
totalPlayers - The total number of players in the tournament
mostValuablePlayer - The player that was sold for the most money first
mostValuablePlayerValue - The value of the MVP
mostValuablePlayerTier - The tier of the MVP
mostValuablePlayerTeam - The team that the MVP ended up going to
(The captains along with their teams are also given, but do not directly mention it in the report as they are already listed separately; only for any extra insight you might discover from the data)
${
    eventsList
        ? `- Notable/funny events to be integrated in the report (but not the main focus):
${eventsList.map(event => event).join('\n')}
`
        : ''
}
`,
                    _auctionStatsObject
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

        return resultsEmbeds;
    }

    private async auctionPlayer(
        auctionChannel: TextChannel,
        currentTier: number,
        currentPlayer: number,
        currentPlayerIndex: number,
        username: string,
        playerList: number[]
    ): Promise<void> {
        const auctionDuration: number = AuctionConfig.auctionDuration;

        Logger.info(
            `Auctioning player Tier ${currentTier} #${
                currentPlayerIndex + 1
            } '${username}' (${currentPlayer})...`
        );

        // Create thread
        const threadPrefix = AuctionConfig.threadPrefix;
        const thread = await auctionChannel.threads.create({
            name: `${threadPrefix}: Tier ${currentTier} | ${username}`,
            autoArchiveDuration: 1440,
            reason: 'Auctioning a player',
        });
        thread.setLocked(true);
        StateUtils.writeAuctionStateValues({
            currentThreadId: thread.id,
        });

        // Announce next up
        let nextUpEmbedDesc: string;
        if (currentPlayerIndex === 0) {
            nextUpEmbedDesc = 'First up!';
        } else {
            nextUpEmbedDesc = 'Next up...';
        }
        const nextUpEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getPrimaryColor())
            .setTitle(username)
            .setDescription('The bidding will start in a few seconds...')
            .setURL(`https://osu.ppy.sh/users/${currentPlayer}`)
            .setAuthor({
                name: `${nextUpEmbedDesc}`,
            })
            .setImage(`https://s.ppy.sh/a/${currentPlayer}`)
            .addFields([
                {
                    name: 'Tier',
                    value: `${currentTier}`,
                    inline: true,
                },
            ]);
        await thread.send({ embeds: [nextUpEmbed] });

        // Wait a bit
        await delay(4000);

        await StateUtils.writeAuctionStateValues({
            biddingActive: true,
            timeRemaining: auctionDuration,
        });
        thread.setLocked(false);

        // Announce in thread
        const minBid = AuctionConfig.minBid;
        const maxBid = AuctionConfig.maxBidIncrement;
        const bidsOpenEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getSuccessColor())
            .setTitle(`Bids are open!`)
            .setDescription('Use `/bid [amount]` to bid on this player!')
            .addFields(
                {
                    name: 'Min initial bid',
                    value: `${minBid}`,
                    inline: true,
                },
                {
                    name: 'Max initial bid',
                    value: `${maxBid}`,
                    inline: true,
                }
            );
        await thread.send({ embeds: [bidsOpenEmbed] });

        // Announce in main channel
        const mainChannelMessage = await auctionChannel.send(
            `Bidding for **${username}** has started! \nTime remaining: **${auctionDuration}** seconds!`
        );

        // Timer
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
                    `Bidding for **${username}** has started! \nTime remaining: **${timeRemaining}** seconds.`
                );

                // Decrement time remaining in state
                await StateUtils.writeAuctionStateValues({
                    timeRemaining: (await StateUtils.getTimeRemaining()) - 1,
                });
            }, 1000);
        });

        await waitForEnd;

        // Close bidding
        await StateUtils.writeAuctionStateValues({
            biddingActive: false,
        });

        const auctionEndEmbed = new EmbedBuilder()
            .setColor(RandomUtils.getDangerColor())
            .setTitle(`Bids are now closed!`);
        await thread.send({ embeds: [auctionEndEmbed] });
        await thread.setLocked(true);

        await delay(1000);

        // Announce winner in thread and main channel
        const playersLeft = playerList.length - currentPlayerIndex - 1;
        let playersLeftMessage: string;

        if (playersLeft === 0) {
            playersLeftMessage = `No players left in this tier!`;
        } else if (playersLeft === 1) {
            playersLeftMessage = `There is only **${playersLeft}** player left in this tier (make sure you get at least one)!`;
        } else {
            playersLeftMessage = `There are **${playersLeft}** players left in this tier (make sure you get at least one)!`;
        }

        const highestBidObject = await StateUtils.getHighestBidObject();
        if (highestBidObject === undefined) {
            const noBidsEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getSecondaryColor())
                .setTitle('No bids!')
                .setDescription('This player was moved to the free agent pool.');
            await thread.send({ embeds: [noBidsEmbed] });

            await StateUtils.MovePlayerToFreeAgents();

            await mainChannelMessage.edit(
                `No bid was placed on this player. They will be moved to the free agent pool. \n${playersLeftMessage}`
            );
        } else {
            // Add player to winner's team
            StateUtils.SellPlayer();

            // Announce winner in thread and main channel
            const highestBid = highestBidObject.bid;
            const highestBidderId = highestBidObject.bidderId;
            const highestBidderTeamName = await StateUtils.GetTeamName(highestBidderId);
            const highestBidderOsuName = highestBidObject.bidderName;
            const soldThreadEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getPrimaryColor())
                .setTitle('Sold!')
                .setFields([
                    {
                        name: 'Captain',
                        value: `${highestBidderOsuName}`,
                        inline: true,
                    },
                    {
                        name: 'Team',
                        value: `${highestBidderTeamName}`,
                        inline: true,
                    },
                    {
                        name: 'Price',
                        value: `${highestBid}`,
                        inline: true,
                    },
                ]);
            await thread.send({ embeds: [soldThreadEmbed] });

            await mainChannelMessage.edit(
                `**${username}** has been sold to **${highestBidderOsuName}** (${highestBidderTeamName}) for **${highestBid}**! \n${playersLeftMessage}`
            );
        }

        await delay(3 * 1000);
        await thread.setArchived(true);
    }

    public async execute(intr: ChatInputCommandInteraction, _data: EventData): Promise<void> {
        // Initialize variables
        const channel: TextChannel = intr.channel as TextChannel;
        let playerAmount = 0;
        let shuffledPlayers: PlayersList;
        let currentPlayerIndex = 0;
        let initialTierIndex = 0;
        const loadingMessages = RandomUtils.shuffle(StartAuctionCommand.loadingMessages);

        // Load Configs
        let PlayersData: PlayersList = await TournamentConfigUtils.getAuctionPlayerConfig();
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
                await intr.deleteReply();
                break;
        }

        // Start auction
        Logger.info(
            `Auction started by @${intr.user.username} (${intr.user.id}) in channel '${channel.name}!' (${channel.id}) in guild '${channel.guild.name}' (${channel.guild.id})!`
        );

        // Reset auction state
        await StateUtils.resetAuctionStateValues();

        // If resuming, load data from file
        // Otherwise, start auction from scratch
        const startingAnnouncementEmbed = new EmbedBuilder();
        let resuming = fs.existsSync('./result/paused.json');
        if (resuming) {
            let PausedStateFile = require('../../../result/paused.json');
            try {
                const resumeData = PausedStateFile as ResumeData;
                Logger.info(`Pause state file found, resuming auction...`);

                resumeData.auctionState.status = 'running';

                // Current Tier & Player
                initialTierIndex = resumeData.auctionState.currentTierIndex;
                currentPlayerIndex = resumeData.currentPlayerIndex;
                Logger.debug(
                    `Resuming from: Tier Index ${initialTierIndex} & Player Index ${currentPlayerIndex}`
                );

                // Player Order
                shuffledPlayers = resumeData.shuffledPlayers;
                for (const key in shuffledPlayers) {
                    PlayersData[key] = shuffledPlayers[key];
                }
                Logger.info('Player Order (From Paused State):', PlayersData);

                // Misc.
                await StateUtils.ResumeAuction(resumeData);

                fs.unlink('./result/paused.json', err => {
                    if (err) {
                        Logger.error('Error while deleting pause state file.', err);
                        return;
                    }
                    Logger.debug('Pause state file deleted.');
                });

                startingAnnouncementEmbed
                    .setColor(RandomUtils.getPrimaryColor())
                    .setTitle('Auction resuming.')
                    .setDescription('The auction will be resumed shortly!');

                await StateUtils.writeAuctionStateValues({
                    status: 'running',
                });
            } catch (e) {
                Logger.error(
                    `Error reading resume file, please check or delete the file! Aborting.`,
                    e
                );
                return;
            }
        } else {
            startingAnnouncementEmbed
                .setColor(RandomUtils.getPrimaryColor())
                .setTitle('Auction starting!')
                .setDescription(
                    'The auction will be starting shortly. The bidding will be pretty fast-paced, so be ready! \n\nNote: Bidding will take place **inside of each thread**.'
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
            if (AuctionConfig.shufflePlayers) {
                for (let i = 0; i < AuctionConfig.tierOrder.length; i++) {
                    const tier = AuctionConfig.tierOrder[i];
                    PlayersData[tier] = RandomUtils.shuffle(PlayersData[tier]);
                }
                Logger.info('Player Order (Shuffled):', PlayersData);
            } else {
                Logger.info('Player Order (File Ordered):', PlayersData);
            }
        }
        await intr.channel.send({ embeds: [startingAnnouncementEmbed] });

        await delay(10000);

        // Pause Data variables
        let pauseTierIndex = 0;
        let pausePlayerIndex = 0;

        const tierOrder = AuctionConfig.tierOrder;
        for (let i = initialTierIndex; i < tierOrder.length; i++) {
            // Check if auction is paused or aborted
            if ((await StateUtils.getStatus()) === 'aborting') {
                break;
            } else if ((await StateUtils.getStatus()) === 'pausing') {
                break;
            }

            // Update current tier index
            StateUtils.writeAuctionStateValues({
                currentTierIndex: i,
                currentTier: tierOrder[i],
            });

            const currentTier = tierOrder[i];
            Logger.info(`Auctioning tier ${currentTier} players...`);

            // Announce next tier
            const NextTierEmbed = new EmbedBuilder()
                .setColor(RandomUtils.getTertiaryColor())
                .setAuthor({
                    name: i === 0 ? 'First up!' : `Next up!`,
                })
                .setTitle(`Tier ${currentTier} players!`);
            await auctionChannel.send({ embeds: [NextTierEmbed] });

            await delay(5000);

            // Auction each player
            let currentPlayerList = PlayersData[currentTier];
            for (let u = resuming ? currentPlayerIndex : 0; u < currentPlayerList.length; u++) {
                const currentPlayerId = currentPlayerList[u];

                // Get player info
                const apiLink = `https://osu.ppy.sh/api/get_user?k=${ApiKeyConfig.osuApiKey}&u=${currentPlayerId}&m=0&type=id`;
                const apiResponse = await fetch(apiLink);
                // check if response is ok, if not, skip player
                if (!apiResponse.ok) {
                    Logger.error(
                        `Error while fetching player info for player ${currentPlayerId}! Skipping...`
                    );
                    continue;
                }
                const playerObject: unknown = await apiResponse.json();
                const username = playerObject[0].username;
                const _rank = playerObject[0].pp_rank;

                // Reset states
                await StateUtils.writeAuctionStateValues({
                    currentPlayer: currentPlayerId,
                    currentPlayerName: username,
                    highestBid: undefined,
                    highestBidderId: undefined,
                });

                await this.auctionPlayer(
                    auctionChannel,
                    currentTier,
                    currentPlayerId,
                    u,
                    username,
                    currentPlayerList
                );

                // Check if auction is queued to pause or abort
                if ((await StateUtils.getStatus()) === 'aborting') {
                    break;
                } else if ((await StateUtils.getStatus()) === 'pausing') {
                    // If last cycle was the last player in the tier,
                    // reset current player index to 0 and increment tier index before breaking
                    if (u === currentPlayerList.length - 1) {
                        pausePlayerIndex = 0;
                        pauseTierIndex = i + 1;
                    } else {
                        pausePlayerIndex = currentPlayerIndex + 1;
                        pauseTierIndex = i;
                    }

                    break;
                }
            }
        }

        // Post-auction
        const completionEmbed = new EmbedBuilder();
        switch (await StateUtils.getStatus()) {
            case 'pausing':
                this.pauseData.auctionState = await StateUtils.getState();
                this.pauseData.auctionState.status = 'idle';
                this.pauseData.auctionState.currentTierIndex = pauseTierIndex;
                this.pauseData.auctionState.currentTier = tierOrder[pauseTierIndex];
                this.pauseData.auctionState.currentPlayer = undefined;
                this.pauseData.auctionState.currentPlayerName = undefined;

                this.pauseData.auctionStats = await StateUtils.GetAuctionStats();
                for (const key in PlayersData) {
                    this.pauseData.shuffledPlayers[key] = PlayersData[key];
                }
                this.pauseData.freeAgents = await StateUtils.GetFreeAgentObject();
                this.pauseData.captains = await StateUtils.GetAuctionResults();
                this.pauseData.currentPlayerIndex = pausePlayerIndex;
                try {
                    await writeToFile('./result/paused.json', JSON.stringify(this.pauseData));
                    Logger.debug('Wrote pause data:', this.pauseData);

                    await StateUtils.resetAuctionStateValues();

                    Logger.info('Auction successfully paused.');
                    completionEmbed
                        .setColor(RandomUtils.getSecondaryColor())
                        .setTitle('Auction paused.')
                        .setDescription(`The auction has been paused by an admin.`);

                    await StateUtils.writeAuctionStateValues({
                        status: 'idle',
                    });

                    await auctionChannel.send({ embeds: [completionEmbed] });
                    return;
                } catch (e) {
                    Logger.error('Failed to write pause data to file.', e);
                    return;
                }
            case 'aborting':
                await StateUtils.resetAuctionStateValues();

                Logger.info('Auction successfully aborted.');
                completionEmbed
                    .setColor(RandomUtils.getDangerColor())
                    .setTitle('Auction aborted.')
                    .setDescription(`The auction has been aborted by an admin.`);

                await auctionChannel.send({ embeds: [completionEmbed] });
                return;
            default:
                Logger.info('Auction completed successfully.');
                completionEmbed
                    .setColor(RandomUtils.getTertiaryColor())
                    .setTitle('Auction finished!')
                    .setDescription(`That's all folks, the auction has concluded!`);

                await auctionChannel.send({ embeds: [completionEmbed] });
                break;
        }

        // Export to file
        try {
            const auctionExportedResults = await StateUtils.GetAuctionResults();
            let resultsArray = [];
            let playersArray = [];
            let costsArray = [];
            for (const key in auctionExportedResults) {
                // Results 1: Team Name
                resultsArray.push(auctionExportedResults[key].teamname);
                let teamSlotsLeft = 9;

                // Results 2.1: Team Members | Captain
                resultsArray.push(auctionExportedResults[key].osuId);

                // Results 2.2: Team Members | Players
                let teamArray: TeamMembers[] = [];
                for (const player of auctionExportedResults[key].teammembers) {
                    teamArray.push(player);
                    teamSlotsLeft--;

                    // Costs Array: Player
                    playersArray.push(player.id);
                    costsArray.push(player.cost);
                }

                // Results 2.2.1: Team Members | Players
                // Sort by tier 1-4
                teamArray.sort((a, b) => {
                    return a.tier - b.tier;
                });
                for (const player of teamArray) {
                    resultsArray.push(player.id);
                }

                // Results 2.3: Empty Markers
                for (let i = 0; i < teamSlotsLeft; i++) {
                    resultsArray.push('empty slot');
                }

                // Costs Array: Captain
                playersArray.push(auctionExportedResults[key].osuId);
                costsArray.push(0);

                // Results 3: End of Team Marker
                resultsArray.push(';');
            }

            const auctionExportedStats = await StateUtils.GetAuctionStats();
            const auctionExportedFreeAgents = await StateUtils.GetFreeAgentList();
            const exportedFile = {
                teams: resultsArray,
                teamCosts: {
                    players: playersArray,
                    costs: costsArray,
                },
                stats: auctionExportedStats,
                freeAgents: auctionExportedFreeAgents,
            };

            const resultsFilePath = './result/results.json';

            // Check if file exists
            if (fs.existsSync(resultsFilePath)) {
                Logger.info('A results file already exists. Deleting...');
                fs.unlinkSync(resultsFilePath);
            }

            // Write to file
            await writeToFile(resultsFilePath, JSON.stringify(exportedFile));
            Logger.info('Results written to file.');
        } catch (e) {
            console.error('Failed to export file', e);
        }

        // Generate report
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

        const resultsEmbeds = await this.generateReport();

        await resultsMessage.edit({ embeds: resultsEmbeds });
        clearInterval(cycleLoadingMessages);

        // Reset states
        await StateUtils.resetAuctionStateValues();
    }
}
