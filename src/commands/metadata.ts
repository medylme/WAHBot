import {
    ApplicationCommandOptionType,
    ApplicationCommandType,
    RESTPostAPIChatInputApplicationCommandsJSONBody,
    RESTPostAPIContextMenuApplicationCommandsJSONBody,
} from 'discord.js';
import { createRequire } from 'node:module';

import { Args } from './index.js';
import { Language } from '../models/enum-helpers/index.js';
import { Lang } from '../services/index.js';

const require = createRequire(import.meta.url);
let auctionConfig = require('../../config/tournament/config.json');

export const ChatCommandMetadata: {
    [command: string]: RESTPostAPIChatInputApplicationCommandsJSONBody;
} = {
    HELP: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.help', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.help'),
        description: Lang.getRef('commandDescs.help', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.help'),
        dm_permission: true,
        default_member_permissions: undefined,
        options: [
            {
                ...Args.HELP_OPTION,
                required: true,
            },
        ],
    },
    /*
    INFO: {
        type: ApplicationCommandType.ChatInput,
        name: Lang.getRef('chatCommands.info', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('chatCommands.info'),
        description: Lang.getRef('commandDescs.info', Language.Default),
        description_localizations: Lang.getRefLocalizationMap('commandDescs.info'),
        dm_permission: true,
        default_member_permissions: '8',
        options: [
            {
                ...Args.INFO_OPTION,
                required: true,
            },
        ],
    },
    */
    CHECK: {
        type: ApplicationCommandType.ChatInput,
        name: 'check',
        name_localizations: undefined,
        description: 'Check if a player/captain is (properly) registered in the bot.',
        description_localizations: undefined,
        dm_permission: true,
        default_member_permissions: undefined,
        options: [
            {
                name: 'osu-id',
                description: 'Check if a player/captain is (properly) registered by osu! user id.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'value',
                        description: 'osu! id of the person to check.',
                        type: ApplicationCommandOptionType.Integer,
                        required: true,
                    },
                ],
            },
            {
                name: 'osu-username',
                description: 'Check if a player/captain is (properly) registered by osu! username.',
                type: ApplicationCommandOptionType.Subcommand,
                options: [
                    {
                        name: 'value',
                        description: 'osu! username of the person to check.',
                        type: ApplicationCommandOptionType.String,
                        required: true,
                    },
                ],
            },
        ],
    },
    STARTAUCTION: {
        type: ApplicationCommandType.ChatInput,
        name: 'startauction',
        name_localizations: undefined,
        description: 'Start an auction in the current text channel.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
    },
    PAUSEAUCTION: {
        type: ApplicationCommandType.ChatInput,
        name: 'pauseauction',
        name_localizations: undefined,
        description: 'Queue an ongoing auction to pause.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
    },
    ABORTAUCTION: {
        type: ApplicationCommandType.ChatInput,
        name: 'abortauction',
        name_localizations: undefined,
        description: 'Queue an ongoing auction to abort.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
    },
    CLEARTHREADS: {
        type: ApplicationCommandType.ChatInput,
        name: 'clearthreads',
        name_localizations: undefined,
        description: 'Clear all auction threads in the current text channel.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
    },
    BID: {
        type: ApplicationCommandType.ChatInput,
        name: 'bid',
        name_localizations: undefined,
        description: 'Place a bid on a player during an auction.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: undefined,
        options: [
            {
                name: 'amount',
                description: 'The amount to bid.',
                type: ApplicationCommandOptionType.Integer,
                min_value: auctionConfig.minBid,
                max_value: auctionConfig.maxBid,
                required: true,
            },
        ],
    },
    SKIPPLAYER: {
        type: ApplicationCommandType.ChatInput,
        name: 'skipplayer',
        name_localizations: undefined,
        description: `Skip the timer for the current player that is being auctioned off.`,
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
    },
    ADDEVENT: {
        type: ApplicationCommandType.ChatInput,
        name: 'addevent',
        name_localizations: undefined,
        description: `Add an event to the current auction to be mentioned by WaffleBot's final report.`,
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: '8',
        options: [
            {
                name: 'event',
                description: 'The event to add.',
                type: ApplicationCommandOptionType.String,
                required: true,
            },
        ],
    },
    BALANCE: {
        type: ApplicationCommandType.ChatInput,
        name: 'balance',
        name_localizations: undefined,
        description: 'Show your current balance in the current auction.',
        description_localizations: undefined,
        dm_permission: false,
        default_member_permissions: undefined,
    },
};

export const MessageCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    /*
    VIEW_DATE_SENT: {
        type: ApplicationCommandType.Message,
        name: Lang.getRef('messageCommands.viewDateSent', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('messageCommands.viewDateSent'),
        default_member_permissions: undefined,
        dm_permission: true,
    },
    */
};

export const UserCommandMetadata: {
    [command: string]: RESTPostAPIContextMenuApplicationCommandsJSONBody;
} = {
    /*
    VIEW_DATE_JOINED: {
        type: ApplicationCommandType.User,
        name: Lang.getRef('userCommands.viewDateJoined', Language.Default),
        name_localizations: Lang.getRefLocalizationMap('userCommands.viewDateJoined'),
        default_member_permissions: undefined,
        dm_permission: true,
    },
    */
};
