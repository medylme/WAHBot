import { createRequire } from 'node:module';

import { Logger } from '../services/index.js';

const require = createRequire(import.meta.url);
const ApiKeysConfig = require('../../config/tournament/apiKeys.json');

export class OsuApiUtils {
    private static apiKey: string = ApiKeysConfig.osuApiKey;

    public static async pingApi(): Promise<boolean> {
        // Test osu! key
        const osuEndpoint = `https://osu.ppy.sh/api/get_user?k=${this.apiKey}&u=1`;

        try {
            const response = await fetch(osuEndpoint);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.length === 0) {
                throw new Error('osu! API returned no data!');
            }

            return true;
        } catch (err) {
            Logger.error('Failed to ping osu! API', err);
            return false;
        }
    }

    public static async getOsuId(username: string): Promise<number | null> {
        // Find osu! user id
        const osuEndpoint = `https://osu.ppy.sh/api/get_user?k=${this.apiKey}&u=${username}&type=string`;

        try {
            const response = await fetch(osuEndpoint);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.length === 0) {
                return null;
            }

            return data[0].user_id as number;
        } catch (err) {
            throw new Error('Something went wrong while fetching from the osu! endpoint!');
        }
    }

    public static async getOsuUsername(osuId: number): Promise<string | null> {
        // Find osu! username
        const osuEndpoint = `https://osu.ppy.sh/api/get_user?k=${this.apiKey}&u=${osuId}&type=id`;

        try {
            const response = await fetch(osuEndpoint);
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.length === 0) {
                return null;
            }

            return data[0].username as string;
        } catch (err) {
            throw new Error('Something went wrong while fetching from the osu! endpoint!');
        }
    }
}
