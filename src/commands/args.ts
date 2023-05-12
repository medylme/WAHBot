import { APIApplicationCommandBasicOption, ApplicationCommandOptionType } from 'discord.js';

import { HelpOption, InfoOption } from '../enums/index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

export class Args {
    public static readonly HELP_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.option', Language.Default),
        name_localizations: undefined,
        description: Lang.getRef('argDescs.option', Language.Default),
        description_localizations: undefined,
        type: ApplicationCommandOptionType.String,
        choices: [
            {
                name: 'auction',
                name_localizations: undefined,
                value: HelpOption.AUCTION,
            },
        ],
    };
    public static readonly INFO_OPTION: APIApplicationCommandBasicOption = {
        name: Lang.getRef('arguments.option', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('arguments.option'),
        description: Lang.getRef('argDescs.option', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('argDescs.option'),
        type: ApplicationCommandOptionType.String,
        choices: [
            {
                name: Lang.getRef('infoOptions.about', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('infoOptions.about'),
                value: InfoOption.ABOUT,
            },
            {
                name: Lang.getRef('infoOptions.translate', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('infoOptions.translate'),
                value: InfoOption.TRANSLATE,
            },
            {
                name: Lang.getRef('infoOptions.dev', Language.Default),
                name_localizations: Lang.getRefLocalizationMap('infoOptions.dev'),
                value: InfoOption.DEV,
            },
        ],
    };
}
