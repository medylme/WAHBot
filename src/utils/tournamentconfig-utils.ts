import { createRequire } from 'node:module';

import { OpenAIUtils, OsuApiUtils } from './index.js';
import { PlayersList } from '../models/state-models.js';
import {
    ApiKeyConfigProps,
    AuctionCaptainConfigProps,
    AuctionConfigProps,
    AuctionPlayerConfigProps,
} from '../models/tournamentconfig-models.js';
import { Logger } from '../services/index.js';

const require = createRequire(import.meta.url);

export class TournamentConfigUtils {
    private static ApiKeyConfig: ApiKeyConfigProps = require('../../config/tournament/apiKeys.json');
    private static AuctionCaptainConfig: AuctionCaptainConfigProps = require('../../config/tournament/captains.json');
    private static AuctionConfig: AuctionConfigProps = require('../../config/tournament/config.json');
    private static AuctionPlayerConfig: AuctionPlayerConfigProps = require('../../config/tournament/players.json');

    public static async getApiKeysConfig(): Promise<ApiKeyConfigProps> {
        return this.ApiKeyConfig;
    }

    public static async getAuctionCaptainConfig(): Promise<AuctionCaptainConfigProps> {
        return this.AuctionCaptainConfig;
    }

    public static async getAuctionConfig(): Promise<AuctionConfigProps> {
        return this.AuctionConfig;
    }

    public static async getAuctionPlayerConfig(): Promise<PlayersList> {
        const CaptainConfig = await this.getAuctionCaptainConfig();
        let CaptainOsuIds: number[] = [];
        Object.keys(CaptainConfig).forEach(async captainId => {
            const captainOsuId = CaptainConfig[captainId].osuId;
            CaptainOsuIds.push(captainOsuId);
        });

        const PlayerConfig = this.AuctionPlayerConfig;
        let PlayerArrayWithoutCaptains: PlayersList = {
            '1': [],
            '2': [],
            '3': [],
            '4': [],
        };
        for (let tier = 1; tier <= 4; tier++) {
            const tierArray = PlayerConfig[tier.toString()];
            tierArray.forEach(player => {
                if (!CaptainOsuIds.includes(Number(player))) {
                    PlayerArrayWithoutCaptains[tier].push(player);
                } else {
                    Logger.warn(
                        `Captain ID '${player}' found in the player list. Automatically excluding from list.`
                    );
                }
            });
        }

        return PlayerArrayWithoutCaptains;
    }

    public static async readConfigs(): Promise<void> {
        Logger.debug('Read tournament configs.');

        try {
            this.ApiKeyConfig = await require('../../config/tournament/apiKeys.json');
            this.AuctionCaptainConfig = await require('../../config/tournament/captains.json');
            this.AuctionConfig = await require('../../config/tournament/config.json');
            this.AuctionPlayerConfig = await require('../../config/tournament/players.json');
        } catch (e) {
            Logger.error(
                'Failed to load one (or more) config file! Did you set all config files up correctly?'
            );
            process.exit(1);
        }
    }

    public static async checkTournamentConfigs(): Promise<void> {
        Logger.debug('Performing config validation checks...');

        this.checkConfig();
        Logger.debug('Auction Config OK');
        this.checkPlayerConfig();
        Logger.debug('Auction Player Config OK');
        this.checkCaptainConfig();
        Logger.debug('Auction Captain Config OK');
        await this.checkApiKeys();
        Logger.debug('API Key Config OK');
    }

    private static async checkApiKeys(): Promise<void> {
        const osuApiKey = this.ApiKeyConfig.osuApiKey;
        const openaiApiKey = this.ApiKeyConfig.openaiApiKey;

        if (!osuApiKey) {
            throw new Error('osu! API key (v1) is missing!');
        }

        if (!openaiApiKey) {
            throw new Error('OpenAI API key is missing!');
        }

        // Test osu! API
        const osuApiPingRes = await OsuApiUtils.pingApi();
        if (!osuApiPingRes) {
            throw new Error('Something went wrong while fetching from the osu! endpoint!');
        }

        // Test OpenAI
        const openaiPingRes = await OpenAIUtils.pingApi();
        if (!openaiPingRes) {
            throw new Error('Something went wrong while fetching from the OpenAI endpoint!');
        }
    }

    private static checkConfig(): void {
        if (
            !this.AuctionConfig.auctionDuration ||
            !this.AuctionConfig.resetDuration ||
            !this.AuctionConfig.maxBid ||
            !this.AuctionConfig.minBid ||
            !this.AuctionConfig.minBidIncrement ||
            !this.AuctionConfig.maxBidIncrement ||
            !this.AuctionConfig.maxTeamSize ||
            !this.AuctionConfig.startingBalance ||
            !this.AuctionConfig.shufflePlayers ||
            !this.AuctionConfig.tierOrder ||
            !this.AuctionConfig.threadPrefix
        ) {
            throw new Error('Tournament config is missing required fields!');
        }

        // Type Checks

        if (typeof this.AuctionConfig.shufflePlayers !== 'boolean') {
            throw new Error(`Shuffle players must be true or false!`);
        }

        if (typeof this.AuctionConfig.auctionDuration !== 'number') {
            throw new Error(`Auction duration must be a number!`);
        }

        if (typeof this.AuctionConfig.resetDuration !== 'number') {
            throw new Error(`Reset duration must be a number!`);
        }

        if (typeof this.AuctionConfig.minBid !== 'number') {
            throw new Error(`Min bid must be a number!`);
        }

        if (typeof this.AuctionConfig.maxBid !== 'number') {
            throw new Error(`Max bid must be a number!`);
        }

        if (typeof this.AuctionConfig.minBidIncrement !== 'number') {
            throw new Error(`Min bid increment must be a number!`);
        }

        if (typeof this.AuctionConfig.maxBidIncrement !== 'number') {
            throw new Error(`Max bid increment must be a number!`);
        }

        if (typeof this.AuctionConfig.startingBalance !== 'number') {
            throw new Error(`Starting balance must be a number!`);
        }

        if (typeof this.AuctionConfig.maxTeamSize !== 'number') {
            throw new Error(`Max team size must be a number!`);
        }

        if (typeof this.AuctionConfig.shufflePlayers !== 'boolean') {
            throw new Error(`Shuffle players must be a boolean!`);
        }

        if (typeof this.AuctionConfig.AIReport !== 'boolean') {
            throw new Error(`AI report must be a boolean!`);
        }

        if (typeof this.AuctionConfig.threadPrefix !== 'string') {
            throw new Error(`Thread prefix must be a string!`);
        }

        // Content Checks

        if (this.AuctionConfig.auctionDuration < 1 || this.AuctionConfig.auctionDuration > 1440) {
            throw new Error(
                `Auction duration must be greater than 0! Please use a value between 1 and 1440.`
            );
        }

        if (this.AuctionConfig.resetDuration < 1 || this.AuctionConfig.resetDuration > 1440) {
            throw new Error(
                `Auction duration must be greater than 0! Please use a value between 1 and 1440.`
            );
        }

        if (this.AuctionConfig.resetDuration > this.AuctionConfig.auctionDuration) {
            throw new Error(`Reset duration must be less than auction duration!`);
        }

        if (this.AuctionConfig.minBid < 1 || this.AuctionConfig.minBid > 1000000) {
            throw new Error(
                `Starting bid must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (this.AuctionConfig.maxBid < 1 || this.AuctionConfig.maxBid > 1000000) {
            throw new Error(
                `Starting bid must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (this.AuctionConfig.minBid > this.AuctionConfig.maxBid) {
            throw new Error(`Starting bid must be less than max bid!`);
        }

        if (
            this.AuctionConfig.minBidIncrement < 1 ||
            this.AuctionConfig.minBidIncrement > 1000000
        ) {
            throw new Error(
                `Min bid increment must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (
            this.AuctionConfig.maxBidIncrement < 1 ||
            this.AuctionConfig.maxBidIncrement > 1000000
        ) {
            throw new Error(
                `Max bid increment must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (this.AuctionConfig.minBidIncrement > this.AuctionConfig.maxBidIncrement) {
            throw new Error(`Min bid increment must be less than max bid increment!`);
        }

        if (
            this.AuctionConfig.startingBalance < 1 ||
            this.AuctionConfig.startingBalance > 1000000
        ) {
            throw new Error(
                `Starting balance must be greater than 0! Please use a value between 1 and 1000000.`
            );
        }

        if (
            this.AuctionConfig.tierOrder.length !== 4 ||
            this.AuctionConfig.tierOrder.some((tier: number) => ![1, 2, 3, 4].includes(tier))
        ) {
            throw new Error(
                `Tier order is incorrect. Please provide a valid array of tiers 1 to 4.`
            );
        }

        if (this.AuctionConfig.maxTeamSize < 1 || this.AuctionConfig.maxTeamSize > 100) {
            throw new Error(
                `Max team size must be greater than 0! Please use a value between 1 and 100.`
            );
        }
    }

    private static checkPlayerConfig(): void {
        const obj = this.AuctionPlayerConfig;

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

    private static checkCaptainConfig(): void {
        const obj = this.AuctionCaptainConfig;

        if (typeof obj !== 'object' || obj === null) {
            throw new Error('Captain config is missing required fields!');
        }

        const keys = Object.keys(obj);
        for (const key of keys) {
            const entry = obj[key];
            if (
                typeof entry !== 'object' ||
                entry === null ||
                !Object.prototype.hasOwnProperty.call(entry, 'teamname') ||
                typeof entry.teamname !== 'string' ||
                !Object.prototype.hasOwnProperty.call(entry, 'osuId') ||
                typeof entry.osuId !== 'number'
            ) {
                throw new Error('Captain config is invalid!');
            }

            // If proxyDiscId is provided, check if it's a string
            if (Object.prototype.hasOwnProperty.call(entry, 'proxyDiscId')) {
                if (typeof entry.proxyDiscId !== 'string') {
                    throw new Error('Captain config is invalid! (Proxy ID must be a string)');
                }

                // Check if main discord id is not the same as the proxy id
                if (entry.proxyDiscId === key) {
                    throw new Error(
                        `Captain config is invalid! (Proxy ID can't be the same as the Captain ID)`
                    );
                }
            }
        }
    }
}
