import { createRequire } from 'node:module';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration, OpenAIApi } from 'openai';

import { Logger } from '../services/logger.js';

const require = createRequire(import.meta.url);

export class OpenAIUtils {
    private static readonly auctionConfig = require('../../config/tournament/config.json');
    private static readonly API_KEY = this.auctionConfig.openaiApiKey;
    private static readonly configuration = new Configuration({
        apiKey: this.API_KEY,
    });
    private static readonly openai = new OpenAIApi(this.configuration);

    public static async GenerateReport(systemPrompt: string, userPrompt: object): Promise<string> {
        const MODEL = 'gpt-3.5-turbo-16k'; // 'gpt-4' - best but slow | 'gpt-3.5-turbo' - faster | 'gpt-3.5-turbo-16k' - maybe an option???

        Logger.debug(`Prompting ${MODEL} with: `, userPrompt);

        const userPromptString = JSON.stringify(userPrompt);
        const completion = await this.openai.createChatCompletion({
            model: MODEL,
            messages: [
                {
                    role: 'system',
                    content: systemPrompt,
                },
                {
                    role: 'user',
                    content: userPromptString,
                },
            ],
        });

        Logger.debug('response:', completion.data);

        const responseString = completion.data.choices[0].message.content;
        return responseString;
    }
}
