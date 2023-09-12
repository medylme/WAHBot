import { createRequire } from 'node:module';
// eslint-disable-next-line import/no-extraneous-dependencies
import { Configuration, OpenAIApi } from 'openai';

import { Logger } from '../services/logger.js';

const require = createRequire(import.meta.url);

export class OpenAIUtils {
    private static readonly apiKeyConfig = require('../../config/tournament/apiKeys.json');
    private static readonly API_KEY = this.apiKeyConfig.openaiApiKey;
    private static readonly configuration = new Configuration({
        apiKey: this.API_KEY,
    });
    private static readonly openai = new OpenAIApi(this.configuration);

    public static async pingApi(): Promise<boolean> {
        const openaiEndpoint = `https://api.openai.com/v1/models`;

        try {
            const response = await fetch(openaiEndpoint, {
                headers: {
                    Authorization: `Bearer ${this.API_KEY}`,
                },
            });
            const data = await response.json();

            if (data.error) {
                throw new Error(data.error);
            }

            if (data.length === 0) {
                throw new Error('OpenAI API returned no data!');
            }

            return true;
        } catch (err) {
            Logger.error('Failed to ping OpenAI API', err);
            return false;
        }
    }

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
