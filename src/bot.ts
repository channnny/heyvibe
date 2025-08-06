import * as log from 'bog';
import config from './config';
import BurritoStore from './store/BurritoStore';
import LocalStore from './store/LocalStore';
import { parseAnonymousMessage, parseMessage } from './lib/parseMessage';
import { validBotMention, validChannel, validMessage } from './lib/validator';
import { boltApp } from './slack';
import Wbc from './slack/Wbc';

const {
    enableDecrement,
    dailyCap,
    dailyDecCap,
    emojiInc,
    emojiDec,
    disableEmojiDec,
} = config.slack;

interface Emojis {
    type: string;
    emoji: string;
}

interface Updates {
    username: string;
    type: string;
}
const emojis: Array<Emojis> = [];

const incEmojis = emojiInc.split(',').map((emoji => emoji.trim()));
incEmojis.forEach((emoji: string) => emojis.push({ type: 'inc', emoji }));

if (!disableEmojiDec) {
    const decEmojis = emojiDec.split(',').map((emoji => emoji.trim()));
    decEmojis.forEach((emoji: string) => emojis.push({ type: 'dec', emoji }));
}

const giveBurritos = async (giver: string, updates: Updates[]) => {
    return updates.reduce(async (prev: any, burrito) => {
        return prev.then(async () => {
            if (burrito.type === 'inc') {
                await BurritoStore.giveBurrito(burrito.username, giver);
            } else if (burrito.type === 'dec') {
                await BurritoStore.takeAwayBurrito(burrito.username, giver);
            }
        });
    }, Promise.resolve());
};

const notifyUser = (user: string, message: string) => Wbc.sendDM(user, message);

const handleBurritos = async (giver: string, updates: Updates[]) => {
    if (enableDecrement) {
        const burritos = await BurritoStore.givenBurritosToday(giver, 'from');
        const diff = dailyCap - burritos;
        if (updates.length > diff) {
            notifyUser(giver, `${updates.length}개의 칭찬을 주려고 했는데, ${diff}개의 칭찬이 오늘 남아있어요! 메시지를 삭제하고 갯수에 맞게 다시 작성해주세요 ;)`);
            return false;
        }
        if (burritos >= dailyCap) {
            return false;
        }
        await giveBurritos(giver, updates);
    } else {
        const givenBurritos = await BurritoStore.givenToday(giver, 'from', 'inc');
        const givenRottenBurritos = await BurritoStore.givenToday(giver, 'from', 'dec');
        const incUpdates = updates.filter((x) => x.type === 'inc');
        const decUpdates = updates.filter((x) => x.type === 'dec');
        const diffInc = dailyCap - givenBurritos;
        const diffDec = dailyDecCap - givenRottenBurritos;
        if (incUpdates.length) {
            if (incUpdates.length > diffInc) {
                notifyUser(giver, `${updates.length}개의 칭찬을 주려고 했는데, ${diffInc}개의 칭찬이 오늘 남아있어요! 메시지를 삭제하고 갯수에 맞게 다시 작성해주세요 ;)`);
            } else {
                await giveBurritos(giver, incUpdates);
            }
        }
        if (decUpdates.length) {
            if (decUpdates.length > diffDec) {
                notifyUser(giver, `You are trying to give away ${updates.length} rottenburritos, but you only have ${diffDec} rottenburritos left today!`);
            } else {
                await giveBurritos(giver, decUpdates);
            }
        }
    }
    return true;
};

async function notifyChannel(text, channel: string = 'C098TPGKMAQ') {
    await boltApp.client.chat.postMessage({
        channel,
        text,
        blocks: [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*[익명의 칭찬을 대신 전해드려요!]*\n${text}` },
            },
        ],
    });
}

// slash command text 정규화
const canonicalize = (text = '') => text
    // users: <@U123|nick> -> <@U123>
    .replace(/<@([UW][A-Z0-9]+)(\|[^>]+)?>/gi, '<@$1>')
    // channels: <#C123|name> -> <#C123>
    .replace(/<#(C[A-Z0-9]+)(\|[^>]+)?>/gi, '<#$1>')
    // user groups: <!subteam^S123|@group> -> <!subteam^S123>
    .replace(/<!subteam\^([SW][A-Z0-9]+)(\|[^>]+)?>/gi, '<!subteam^$1>')
    // mailto/link: <mailto:a@b|a@b>, <https://..|text> -> URL만
    .replace(/<mailto:([^|>]+)(\|[^>]+)?>/gi, '$1')
    .replace(/<([^|>]+)\|[^>]+>/g, '$1');

const start = () => {
    boltApp.event('message', async ({ event }) => {
        if (validMessage(event, emojis, LocalStore.getAllBots()) && validChannel(event.channel)) {
            if (validBotMention(event, LocalStore.botUserID())) {
                // Geather data and send back to user
            } else {
                log.info(`event: ${JSON.stringify(event)}`);
                const result = parseMessage(event, emojis);
                if (result) {
                    const { giver, updates } = result;
                    log.info(`giver: ${giver}`);
                    if (updates.length) {
                        await handleBurritos(giver, updates);
                    }
                }
            }
        }
    });

    boltApp.command('/heyvibe', async ({ command, ack, say }) => {
        await ack();

        const giver = command.user_id;
        const rawText = (command.text || '').trim();
        const msg = canonicalize(rawText);

        if (msg.includes(giver)) {
            log.warn('셀프 멘션 불가');
            return;
        }

        if (validChannel(command.channel_id)) {
            log.info(`command: ${JSON.stringify(command)}`);

            const result = parseAnonymousMessage(msg, emojis);
            if (result) {
                const { updates } = result;
                if (updates.length) {
                    if (await handleBurritos(giver, updates)) {
                        await notifyChannel(msg);
                    }
                }
            } else {
                await say('메시지 처리에 실패했어요!');
            }
        }
    });
};

export {
    handleBurritos,
    notifyUser,
    start,
};
