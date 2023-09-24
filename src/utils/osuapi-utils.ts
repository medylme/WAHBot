import { TournamentConfigUtils } from './tournamentconfig-utils.js';
import { Logger } from '../services/index.js';

const ApiKeysConfig = await TournamentConfigUtils.getApiKeysConfig();

export class OsuApiUtils {
    private static readonly apiKey = ApiKeysConfig.osuApiKey;

    public static async pingApi(): Promise<boolean> {
        // Test osu! key
        const osuEndpoint = `https://osu.ppy.sh/api/get_user?k=${this.apiKey}&u=2`;

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
            Logger.error(err);
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

            //  Logger.debug('osu! api | get_user from username:', data);

            return data[0].user_id as number;
        } catch (err) {
            Logger.error(err);
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

            const username = data[0].username.toString();

            if (username === undefined) {
                throw new Error('Something went wrong while fetching from the osu! endpoint!');
            }

            // Logger.debug('osu! api | get_user from id:', data);

            return username;
        } catch (err) {
            Logger.error(err);
        }
    }
}
