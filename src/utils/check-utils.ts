import { createRequire } from 'node:module';

import { Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
let ApiKeyConfig = require('../../config/tournament/apiKeys.json');
let AuctionConfig = require('../../config/tournament/config.json');
let AuctionPlayerConfig = require('../../config/tournament/players.json');

export class CheckUtils {
    public static async checkTournamentConfigs(): Promise<void> {
        Logger.debug('Performing config validation checks...');

        this.checkConfig();
        Logger.debug('Auction Config OK');
        this.checkPlayerConfig();
        Logger.debug('Auction Player Config OK');
        await this.checkApiKeys();
        Logger.debug('API Key Config OK');
    }

    private static async checkApiKeys(): Promise<void> {
        const osuApiKey = ApiKeyConfig.osuApiKey;
        const openaiApiKey = ApiKeyConfig.openaiApiKey;

        if (!osuApiKey) {
            throw new Error('osu! API key (v1) is missing!');
        }

        if (!openaiApiKey) {
            throw new Error('OpenAI API key is missing!');
        }

        // Test osu! key
        const osuEndpoint = `https://osu.ppy.sh/api/get_user?k=${osuApiKey}&u=1`;

        try {
            const response = await fetch(osuEndpoint);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }
        } catch (err) {
            throw new Error('Something went wrong while fetching from the osu! endpoint!');
        }

        // Test OpenAI key
        const openaiEndpoint = `https://api.openai.com/v1/models`;

        try {
            const response = await fetch(openaiEndpoint, {
                headers: {
                    Authorization: `Bearer ${openaiApiKey}`,
                },
            });
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }
        } catch (err) {
            throw new Error('Something went wrong while fetching from the OpenAI endpoint!');
        }
    }

    private static checkConfig(): void {
        if (
            !AuctionConfig.auctionDuration ||
            !AuctionConfig.maxBid ||
            !AuctionConfig.minBid ||
            !AuctionConfig.maxTeamSize ||
            !AuctionConfig.startingBalance ||
            !AuctionConfig.shufflePlayers ||
            !AuctionConfig.tierOrder ||
            !AuctionConfig.threadPrefix
        ) {
            throw new Error('Tournament config is missing required fields!');
        }

        if (AuctionConfig.auctionDuration < 1 || AuctionConfig.auctionDuration > 1440) {
            throw new Error(
                `Auction duration must be greater than 0! Please use a value between 1 and 1440.`
            );
        }

        if (AuctionConfig.minBid < 1 || AuctionConfig.minBid > 1000000) {
            throw new Error(
                `Starting bid must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (AuctionConfig.maxBid < 1 || AuctionConfig.maxBid > 1000000) {
            throw new Error(
                `Starting bid must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (AuctionConfig.minBid > AuctionConfig.maxBid) {
            throw new Error(`Starting bid must be less than max bid!`);
        }

        if (AuctionConfig.startingBalance < 1 || AuctionConfig.startingBalance > 1000000) {
            throw new Error(
                `Starting balance must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (
            AuctionConfig.tierOrder.length !== 4 ||
            AuctionConfig.tierOrder.some((tier: number) => ![1, 2, 3, 4].includes(tier))
        ) {
            throw new Error(
                `Tier order is incorrect. Please provide a valid array of tiers 1 to 4.`
            );
        }

        if (AuctionConfig.maxTeamSize < 1 || AuctionConfig.maxTeamSize > 100) {
            throw new Error(
                `Max team size must be greater than 0! Please use a value between 1 and 100.`
            );
        }

        if (typeof AuctionConfig.shufflePlayers !== 'boolean') {
            throw new Error(`Shuffle players must be true or false!`);
        }

        if (typeof AuctionConfig.auctionDuration !== 'number') {
            throw new Error(`Auction duration must be a number!`);
        }

        if (typeof AuctionConfig.minBid !== 'number') {
            throw new Error(`Min bid must be a number!`);
        }

        if (typeof AuctionConfig.maxBid !== 'number') {
            throw new Error(`Max bid must be a number!`);
        }

        if (typeof AuctionConfig.startingBalance !== 'number') {
            throw new Error(`Starting balance must be a number!`);
        }

        if (typeof AuctionConfig.maxTeamSize !== 'number') {
            throw new Error(`Max team size must be a number!`);
        }

        if (typeof AuctionConfig.shufflePlayers !== 'boolean') {
            throw new Error(`Shuffle players must be a boolean!`);
        }

        if (typeof AuctionConfig.AIReport !== 'boolean') {
            throw new Error(`AI report must be a boolean!`);
        }

        if (typeof AuctionConfig.threadPrefix !== 'string') {
            throw new Error(`Thread prefix must be a string!`);
        }
    }

    private static checkPlayerConfig(): void {
        const obj = AuctionPlayerConfig;

        const expectedTiers = ['1', '2', '3', '4'];

        // Check if object has expected number of properties
        if (Object.keys(obj).length !== expectedTiers.length) {
            throw new Error(`Tiers incorrect. Please provide tiers 1-4 in the config.`);
        }

        // Check if each property is a valid tier
        for (const tier in obj) {
            if (!expectedTiers.includes(tier) || !Array.isArray(obj[tier])) {
                throw new Error(`Tier ${tier} is not valid. Please check the config.`);
            }
            // Check if each item in the array is a number
            if (!obj[tier].every(item => typeof item === 'number')) {
                throw new Error(`Tier ${tier} is not valid. Please only provide numbers.`);
            }
        }
    }
}
