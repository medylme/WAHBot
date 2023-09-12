import { Options, Partials } from 'discord.js';
import { createRequire } from 'node:module';

import { CustomClient } from '../extensions/index.js';

const require = createRequire(import.meta.url);
let Config = require('../config/config.json');

export class PresenceUtils {
    public static async setPresence(): Promise<any> {
        return new Error('Not yet implemented');
    }
}
