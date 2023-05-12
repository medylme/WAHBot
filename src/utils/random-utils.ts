import { ColorResolvable } from 'discord.js';

export class RandomUtils {
    public static intFromInterval(min: number, max: number): number {
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    public static shuffle(input: any[]): any[] {
        for (let i = input.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [input[i], input[j]] = [input[j], input[i]];
        }
        return input;
    }

    public static getPrimaryColor(): ColorResolvable {
        return '#f1a23f';
    }

    public static getSecondaryColor(): ColorResolvable {
        return '#808080';
    }

    public static getTertiaryColor(): ColorResolvable {
        return '#969eff';
    }

    public static getSuccessColor(): ColorResolvable {
        return '#3fbf85';
    }

    public static getDangerColor(): ColorResolvable {
        return '#ee4b2b';
    }

    public static getErrorColor(): ColorResolvable {
        return '#880808';
    }
}
