export interface ApiKeyConfigProps {
    readonly osuApiKey: string;
    readonly openaiApiKey: string;
}

export interface AuctionCaptainConfigProps {
    readonly [key: string]: {
        readonly teamname: string;
        readonly osuId: number;
    };
}

export interface AuctionConfigProps {
    auctionDuration: number;
    resetDuration: number;
    minBid: number;
    maxBid: number;
    minBidIncrement: number;
    maxBidIncrement: number;
    maxTeamSize: number;
    AIReport: boolean;
    startingBalance: number;
    shufflePlayers: boolean;
    tierOrder: number[];
    threadPrefix: string;
}

export interface AuctionPlayerConfigProps {
    [key: string]: number[];
}
