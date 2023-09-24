import { OsuApiUtils, TournamentConfigUtils } from './index.js';
import {
    AuctionState,
    AuctionStats,
    Captains,
    CaptainState,
    ResumeData,
    TeamMembers,
} from '../models/state-models.js';
import { Logger } from '../services/logger.js';

const CaptainConfig = await TournamentConfigUtils.getAuctionCaptainConfig();
const AuctionConfig = await TournamentConfigUtils.getAuctionConfig();
const PlayerConfig = await TournamentConfigUtils.getAuctionPlayerConfig();

export class StateUtils {
    private static AuctionStateDefaults = {
        status: 'idle',
        currentTier: undefined,
        currentTierIndex: undefined,
        currentPlayer: undefined,
        currentPlayerName: undefined,
        currentThreadId: undefined,
        biddingActive: false,
        timeRemaining: undefined,
        highestBid: undefined,
        highestBidderId: undefined,
        currentAuctionChannel: undefined,
        totalPlayers: undefined,
        events: [],
    };
    private static AuctionStatsDefaults = {
        totalBids: 0,
        totalSpent: 0,
        mostValuablePlayer: undefined,
        mostValuablePlayerValue: undefined,
        mostValuablePlayerTier: undefined,
        mostValuablePlayerTeam: undefined,
        playersSold: 0,
        totalPlayers: 0,
        biggestSpender: undefined,
        biggestSpenderAmount: undefined,
        biggestSpenderTeam: undefined,
    };
    private static AuctionState: AuctionState = this.AuctionStateDefaults;
    private static AuctionStats: AuctionStats = this.AuctionStatsDefaults;
    private static FreeAgents: TeamMembers[] = [];
    private static Captains: Captains = {};
    private static CaptainUsernameMapPopulated = false;
    private static CaptainUsernameMap: { [key: number]: string } = {};

    private static async populateCaptainUsernameMap(): Promise<void> {
        try {
            Object.keys(CaptainConfig).forEach(async captainId => {
                const osuId = CaptainConfig[captainId].osuId;
                const username = await OsuApiUtils.getOsuUsername(osuId);

                if (username === null) {
                    throw new Error(
                        `Failed to get username for osu! id ${osuId}. Did you enter it correctly?`
                    );
                }

                this.CaptainUsernameMap[osuId] = username;
                Logger.debug(`Captain ID '${osuId}' mapped to username '${username}'.`);
            });

            this.CaptainUsernameMapPopulated = true;
        } catch (e) {
            throw new Error(e);
        }
    }

    private static async getCaptainsFromConfig(): Promise<void> {
        Object.keys(CaptainConfig).forEach(captainId => {
            this.Captains[captainId] = {
                name: this.CaptainUsernameMap[CaptainConfig[captainId].osuId],
                teamname: CaptainConfig[captainId].teamname,
                balance: AuctionConfig.startingBalance,
                discordId: captainId,
                osuId: CaptainConfig[captainId].osuId,
                teammembers: [],
                teamvalue: 0,
                proxyDiscId: CaptainConfig[captainId].proxyDiscId,
            };
        });
    }

    public static async resetAuctionStateValues(): Promise<void> {
        this.AuctionState = { ...this.AuctionStateDefaults };
        this.AuctionStats = { ...this.AuctionStatsDefaults };
        this.FreeAgents = [];
        this.Captains = {};

        if (!this.CaptainUsernameMapPopulated) {
            Logger.debug('Captain username map empty. Fetching from osu! API...');
            await this.populateCaptainUsernameMap();
        }

        try {
            await this.getCaptainsFromConfig();
        } catch (e) {
            Logger.error(e);
            throw new Error(
                'Failed to get captain username from map. Was the config changed without restarting?'
            );
        }

        Logger.info('Auction states reset!');
    }

    // State stuff
    public static async getState(): Promise<AuctionState> {
        return this.AuctionState;
    }

    public static async getStatus(): Promise<string> {
        return this.AuctionState.status;
    }

    public static async addEvent(event: string): Promise<void> {
        this.AuctionState.events.push(event);
    }

    public static async getEvents(): Promise<string[]> {
        return this.AuctionState.events;
    }

    public static async writeAuctionStateValues<K extends keyof AuctionState>(values: {
        [key in K]: AuctionState[K];
    }): Promise<void> {
        Object.keys(values).forEach(key => {
            if (Object.keys(this.AuctionState).includes(key)) {
                StateUtils.AuctionState[key as K] = values[key as K];
            } else {
                throw new Error(`Invalid key: ${key}`);
            }
        });

        // Log all changed states except if timeRemaining is changed
        Object.keys(values).forEach(key => {
            if (key != 'timeRemaining') {
                Logger.debug(`State '${key}' changed to ${values[key as K]}`);
            }
        });

        /*
        // Change status based on auction state
        switch (this.AuctionState.status) {
            case 'running':
                client.user.setStatus('online');
                client.user.setActivity(auctionConfig.threadPrefix, {
                    type: ActivityType.Competing,
                });
                Logger.debug('Set bot status to "online" and updated status.');
                break;
            default:
                client.user.setStatus('idle');
                client.user.setActivity();
                Logger.debug('Set bot status to "idle" and cleared status.');
                break;
        }
        */
    }

    public static async getTimeRemaining(): Promise<number> {
        return this.AuctionState.timeRemaining;
    }

    // Captain stuff
    public static async isCaptainFromDisc(discordId: string): Promise<boolean> {
        return Object.keys(this.Captains).includes(discordId);
    }

    public static async isProxyCaptainFromDisc(discordId: string): Promise<boolean> {
        for (const id in this.Captains) {
            if (this.Captains[id].proxyDiscId === discordId) {
                return true;
            }
        }

        return false;
    }

    public static async getCaptainIdFromProxyDisc(discordId: string): Promise<string> {
        for (const id in this.Captains) {
            if (this.Captains[id].proxyDiscId === discordId) {
                return id;
            }
        }

        return undefined;
    }

    public static async getCaptainStateFromDisc(captainId: string): Promise<Partial<CaptainState>> {
        return this.Captains[captainId];
    }

    public static async getCaptainStateFromOsu(
        query: number | string
    ): Promise<CaptainState | null> {
        let captainOsuId: number;
        let captainState: CaptainState | null = null;

        if (typeof query === 'string') {
            captainOsuId = await OsuApiUtils.getOsuId(query);
        } else {
            captainOsuId = query;
        }

        for (const id in this.Captains) {
            if (Number(this.Captains[id].osuId) == Number(captainOsuId)) {
                captainState = this.Captains[id];
                break;
            }
        }

        return captainState;
    }

    public static async getPlayerStateFromOsu(
        query: number | string
    ): Promise<{ id: number; name: string; tier: number } | null> {
        let playerId: number;
        let playerName: string;

        if (typeof query === 'string') {
            playerId = await OsuApiUtils.getOsuId(query);
            playerName = query;
        } else {
            playerId = query;
            playerName = await OsuApiUtils.getOsuUsername(playerId);
        }

        let playerTier = 0;

        for (let i = 1; i < 5; i++) {
            for (const player of PlayerConfig[i]) {
                if (Number(player) == Number(playerId)) {
                    playerTier = i;
                    break;
                }
            }
        }

        if (playerTier === 0) {
            return null;
        }

        return {
            id: playerId,
            name: playerName,
            tier: playerTier,
        };
    }

    public static async getHighestBid(): Promise<number> {
        try {
            const highestBid = this.AuctionState.highestBid;

            if (highestBid === undefined) {
                return 0;
            }

            return highestBid;
        } catch (e) {
            return 0;
        }
    }

    public static async getHighestBidObject(): Promise<{
        bid: number;
        bidderId: string;
        bidderName: string;
    }> {
        try {
            const captainName = this.Captains[this.AuctionState.highestBidderId].name;

            return {
                bid: this.AuctionState.highestBid,
                bidderId: this.AuctionState.highestBidderId,
                bidderName: captainName,
            };
        } catch (e) {
            return undefined;
        }
    }

    public static async setHighestBid(captainId: string | number, bid: number): Promise<void> {
        const captainIdString = captainId.toString();

        this.AuctionState.highestBid = bid;
        this.AuctionState.highestBidderId = captainIdString;
        this.AuctionStats.totalBids++;

        Logger.info(`New highest bid by '${this.Captains[captainIdString].name}' - ${bid}`);
    }

    public static async MovePlayerToFreeAgents(): Promise<void> {
        Logger.info(`No bids. Player moved to free agents.`);

        let playerId = this.AuctionState.currentPlayer;
        let playerName = this.AuctionState.currentPlayerName;

        // Add player to free agents
        this.FreeAgents.push({
            id: playerId,
            name: playerName,
            tier: this.AuctionState.currentTier,
            cost: 0,
        });
    }

    public static async GetFreeAgentObject(): Promise<TeamMembers[]> {
        return this.FreeAgents;
    }

    public static async GetFreeAgentList(): Promise<number[]> {
        let freeAgentsArray = this.FreeAgents.map(player => Number(player.id));
        return freeAgentsArray;
    }

    private static ClampToTiers(number: number): 1 | 2 | 3 | 4 {
        if (number > 4) {
            return 4;
        } else if (number < 1) {
            return 1;
        } else {
            return number as 1 | 2 | 3 | 4;
        }
    }

    public static async SellPlayer(): Promise<void> {
        let captainId = this.AuctionState.highestBidderId;
        let playerId = this.AuctionState.currentPlayer;
        let playerName = this.AuctionState.currentPlayerName;
        let playerCost = this.AuctionState.highestBid;

        // Update captain balance
        this.Captains[captainId].balance -= playerCost;

        // Add player to captain's team
        this.Captains[captainId].teammembers.push({
            id: playerId,
            name: playerName,
            tier: this.AuctionState.currentTier,
            cost: playerCost,
        });

        // Update captain's team value
        this.Captains[captainId].teamvalue += playerCost;

        // Push to stats
        this.AuctionStats.playersSold++;
        this.AuctionStats.totalSpent += playerCost;

        if (
            this.AuctionStats.mostValuablePlayerValue === undefined ||
            playerCost > this.AuctionStats.mostValuablePlayerValue
        ) {
            this.AuctionStats.mostValuablePlayer = this.AuctionState.currentPlayerName;
            this.AuctionStats.mostValuablePlayerTier = this.ClampToTiers(
                AuctionConfig.tierOrder[this.AuctionState.currentTierIndex]
            );
            this.AuctionStats.mostValuablePlayerValue = playerCost;
            this.AuctionStats.mostValuablePlayerTeam = this.Captains[captainId].teamname;
        }

        Logger.info(`Player sold to '${this.Captains[captainId].name}' for ${playerCost}.`);
    }

    public static async GetBalance(captainId: string): Promise<number> {
        return this.Captains[captainId].balance;
    }

    public static async GetTeamMembers(captainId: string): Promise<object[]> {
        return this.Captains[captainId].teammembers;
    }

    public static async GetTeamName(captainId: string): Promise<string> {
        return this.Captains[captainId].teamname;
    }

    public static async GetAuctionResults(): Promise<Captains> {
        return this.Captains;
    }

    public static async GetAuctionStats(): Promise<AuctionStats> {
        // Return key-value pairs
        return {
            playersSold: this.AuctionStats.playersSold,
            totalBids: this.AuctionStats.totalBids,
            totalSpent: this.AuctionStats.totalSpent,
            totalPlayers: this.AuctionState.totalPlayers,
            mostValuablePlayer: this.AuctionStats.mostValuablePlayer,
            mostValuablePlayerValue: this.AuctionStats.mostValuablePlayerValue,
            mostValuablePlayerTier: this.AuctionStats.mostValuablePlayerTier,
            mostValuablePlayerTeam: this.AuctionStats.mostValuablePlayerTeam,
        };
    }

    // Pausing and resuming
    public static async ResumeAuction(resumeData: ResumeData): Promise<void> {
        // Set auction state
        this.AuctionState = {
            ...this.AuctionState,
            ...resumeData.auctionState,
        };

        // Set free agents
        for (const agent of resumeData.freeAgents) {
            this.FreeAgents.push(agent);
        }

        // Set auction stats
        this.AuctionStats = {
            ...this.AuctionStats,
            ...resumeData.auctionStats,
        };

        // Set captain states
        this.Captains = { ...resumeData.captains };
    }
}
