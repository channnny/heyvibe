import { MongoClient } from 'mongodb';
import { WebClient } from '@slack/web-api';
import dotenv from 'dotenv';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URL || 'mongodb://localhost:27017';
const SLACK_TOKEN = process.env.SLACK_API_TOKEN || '';
const SLACK_CHANNEL = process.env.SLACK_CHANNEL || 'C098TPGKMAQ';
const DATABASE_NAME = process.env.MONGODB_DATABASE || 'heyvibe';

async function main() {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth(); // 0~11

    const prevMonth = month === 0 ? 11 : month - 1;
    const prevYear = month === 0 ? year - 1 : year;

    const from = new Date(prevYear, prevMonth, 1);
    const to = new Date(year, month, 1);

    const client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(DATABASE_NAME);
    const burritos = await db
        .collection('burritos')
        .find({ given_at: { $gte: from, $lt: to } })
        .toArray();

    // 집계
    const scoreMap: Record<string, number> = {};

    burritos.forEach(({ to }) => {
        scoreMap[to] = (scoreMap[to] || 0) + 1;
    });

    const sorted = Object.entries(scoreMap)
        .sort((a, b) => b[1] - a[1])
        .map(([username, score]) => {
            return `<@${username}> - ${score}회`;
        });

    const top3 = sorted.slice(0, 3);

    const reportText = top3.length
        ? `
${top3
            .map((entry, i) => {
                const intro = i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉';
                return `${intro} ${entry}`;
            })
            .join('\n')}

한 달 동안 팀을 따뜻하게 만든 분들입니다!
다 같이 박수~ 👏👏👏`
        : `${prevMonth + 1}월에는 칭찬 내역이 없습니다.`;

    const slack = new WebClient(SLACK_TOKEN);
    await slack.chat.postMessage({
        channel: SLACK_CHANNEL,
        text: reportText,
        blocks: [
            {
                type: 'section',
                text: { type: 'mrkdwn', text: `*🏆 ${prevMonth + 1}월 칭찬왕 TOP 3 🏆*\n${reportText}` },
            },
        ],
    });

    await client.close();
}

main().catch((err) => {
    console.error('월간 리포트 실패:', err);
    process.exit(1);
});
