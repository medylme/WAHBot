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
    freeAgents: number[];
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
    discordId: string;
    osuId: number;
    balance: number;
    teammembers: TeamMembers[];
    teamvalue: number;
    proxyDiscId?: string;
}

export interface Captains {
    [id: string]: CaptainState;
}
