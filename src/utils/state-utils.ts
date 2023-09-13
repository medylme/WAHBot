import { createRequire } from 'node:module';

import { OsuApiUtils } from './index.js';
import { Logger } from '../services/logger.js';

const require = createRequire(import.meta.url);
const CaptainConfig = require('../../config/tournament/captains.json');
const AuctionConfig = require('../../config/tournament/config.json');
const PlayerConfig = require('../../config/tournament/players.json');

export interface AuctionState {
    status: string;
    currentTier: number;
    currentTierIndex: number;
    currentPlayer: string;
    currentPlayerName: string;
    currentThreadId: string;
    biddingActive: boolean;
    timeRemaining: number;
    highestBid: number;
    highestBidderId: string;
    currentAuctionChannel: string;
    totalPlayers: number;
    events: string[];
}

export interface PlayersList {
    [key: number]: number[];
}

export interface ResumeData {
    auctionState: AuctionState;
    auctionStats: AuctionStats;
    currentPlayerIndex: number;
    freeAgents: TeamMembers[];
    shuffledPlayers: PlayersList;
    captains: Captains;
}

export interface AuctionStats {
    totalBids: number;
    totalSpent: number;
    mostValuablePlayer: string;
    mostValuablePlayerValue: number;
    mostValuablePlayerTier: 1 | 2 | 3 | 4;
    mostValuablePlayerTeam: string;
    playersSold: number;
    totalPlayers: number;
}

export interface TeamMembers {
    id: string;
    name: string;
    tier: number;
    cost: number;
}

export interface CaptainState {
    name: string;
    teamname: string;
    osuId: number;
    balance: number;
    teammembers: TeamMembers[];
    teamvalue: number;
}

// Interface for a dictionary of captain objects
export interface Captains {
    [id: string]: CaptainState;
}

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

    public static async resetAuctionStateValues(): Promise<void> {
        this.AuctionState = { ...this.AuctionStateDefaults };
        this.AuctionStats = { ...this.AuctionStatsDefaults };
        this.FreeAgents = [];
        this.Captains = {};

        Object.keys(CaptainConfig).forEach(captainId => {
            this.Captains[captainId] = {
                name: CaptainConfig[captainId].name,
                teamname: CaptainConfig[captainId].teamname,
                balance: AuctionConfig.startingBalance,
                osuId: CaptainConfig[captainId].osuId,
                teammembers: [],
                teamvalue: 0,
            };
        });

        Logger.debug('Auction states reset!');
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

    public static async getHighestBid(): Promise<{
        bid: number;
        bidderId: string;
        bidderName: string;
    }> {
        if (!this.AuctionState.highestBidderId) {
            return undefined;
        }

        const captainName = this.Captains[this.AuctionState.highestBidderId].name;

        return {
            bid: this.AuctionState.highestBid,
            bidderId: this.AuctionState.highestBidderId,
            bidderName: captainName,
        };
    }

    public static async setHighestBid(captainId: string | number, bid: number): Promise<void> {
        this.AuctionState.highestBid = bid;
        this.AuctionState.highestBidderId = captainId.toString();
        this.AuctionStats.totalBids++;

        Logger.info(`New highest bid by '${this.Captains[captainId].name}' - ${bid}`);
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
            this.AuctionStats.mostValuablePlayerTier =
                AuctionConfig.tierOrder[this.AuctionState.currentTierIndex];
            this.AuctionStats.mostValuablePlayerValue = playerCost;
            this.AuctionStats.mostValuablePlayerTeam = this.Captains[captainId].teamname;
        }

        Logger.info(`Player sold to '${this.Captains[captainId].name}' for ${playerCost}.`);
    }

    public static async GetBalance(captainId: string): Promise<number> {
        return this.Captains[captainId].balance;
    }

    public static async GetTeam(captainId: string): Promise<object[]> {
        return this.Captains[captainId].teammembers;
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
