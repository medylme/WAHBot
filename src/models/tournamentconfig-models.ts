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
    readonly auctionDuration: number;
    readonly resetDuration: number;
    readonly minBid: number;
    readonly maxBid: number;
    readonly minBidIncrement: number;
    readonly maxBidIncrement: number;
    readonly maxTeamSize: number;
    readonly AIReport: boolean;
    readonly startingBalance: number;
    readonly shufflePlayers: boolean;
    readonly tierOrder: number[];
    readonly threadPrefix: string;
}

export interface AuctionPlayerConfigProps {
    readonly [key: string]: readonly number[];
}
