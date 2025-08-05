import config from './config';
import mapper from './lib/mapper';
import { sort } from './lib/utils';
import BurritoStore from './store/BurritoStore';


const {
    enableLevel,
    scoreRotation,
} = config.level;

/**
 * Middleware for API and Websocket
 */

/**
 * @param {string} scoretype - inc / dec
 * @param {string} listType - to / from
 * @param {number} year - 년도
 * @param {number} month - 월
 */
const getScoreBoard = async (listType: string, scoreType: string, year?: number, month?: number) => {
    const data = await BurritoStore.getScoreBoard({ listType, scoreType, year, month });
    const score = [];
    const uniqueUsername = [...new Set(data.map((x) => x[listType]))];

    const scoreTypeFilter = (scoreType === 'inc') ? 1 : -1;
    uniqueUsername.forEach((u) => {
        const dataByUser = data.filter((e: any) => (e[listType] === u));
        let filteredData: any;
        let countSwitch: any;

        if (listType === 'to' && config.slack.enableDecrement && (scoreType === 'inc')) {
            filteredData = dataByUser;
        } else {
            filteredData = dataByUser.filter((e: any) => (e.value === scoreTypeFilter));
            countSwitch = 1;
        }
        const red = filteredData.reduce((a: number, item) => a + (countSwitch || item.value), 0);
        score.push({ _id: u, score: red });
    });
    const scoreList = score.map((x) => {
        if (x.score !== 0) return x;
        return undefined;
    }).filter((y) => y);

    if(enableLevel) {
        const levelScoreList = scoreList.map(x => {
            let score = x.score;
            const roundedScore = Math.floor( score / scoreRotation ) * scoreRotation;
            const level = Math.floor((score -1) / scoreRotation);
            const newScore = ((score - roundedScore) === 0 ? roundedScore - (score - scoreRotation) : score - roundedScore);
            return {
                _id: x._id,
                score: newScore,
                level,
            }
        });
        return sort(mapper(levelScoreList));
    };

    return sort(mapper(scoreList));
};

const _getUserScoreBoard = async ({ ...args }) => {
    const { listType } = args;
    const data: any = await BurritoStore.getScoreBoard({ ...args });
    const score = [];
    const uniqueUsername = [...new Set(data.map((x) => x[listType]))];
    uniqueUsername.forEach((u) => {
        const dataByUser = data.filter((e: any) => e[listType] === u);
        const scoreinc = dataByUser.filter((x: any) => x.value === 1);
        const scoredec = dataByUser.filter((x: any) => x.value === -1);
        score.push({
            _id: u,
            scoreinc: scoreinc.length,
            scoredec: scoredec.length,
        });
    });
    return score;
};

/**
 * @param {string} user - Slack userId
 * @param {number} year - 년도
 * @param {number} month - 월
 */
const getUserStats = async (user: string, year?: number, month?: number) => {
    const [
        userStats,
        givenList,
        receivedList,
        givenListToday,
        receivedListToday,
    ] = await Promise.all([
        BurritoStore.getUserStats(user),
        _getUserScoreBoard({ user, listType: 'to', year, month }),
        _getUserScoreBoard({ user, listType: 'from', year, month }),
        _getUserScoreBoard({ user, listType: 'to', today: true }),
        _getUserScoreBoard({ user, listType: 'from', today: true }),
    ]);

    return {
        user: mapper([userStats])[0],
        given: sort(mapper(givenList)),
        received: sort(mapper(receivedList)),
        givenToday: sort(mapper(givenListToday)),
        receivedToday: sort(mapper(receivedListToday)),
    };
};

/**
 * @param {string} user - Slack userId
 */
const givenBurritosToday = async (user: string) => {
    const [
        receivedToday,
        givenToday,
    ] = await Promise.all([
        BurritoStore.givenBurritosToday(user, 'to'),
        BurritoStore.givenBurritosToday(user, 'from'),
    ]);

    return {
        givenToday,
        receivedToday,
    };
};

/**
 * @param {string} user - Slack userId
 * @param {string} listType - to / from
 * @param {string} scoreType - inc / dec
 * @param {number} year - 년도
 * @param {number} month - 월
 */
const getUserScore = async (user: string, listType: string, scoreType: string, year?: number, month?: number) => {
    const scoreList = await BurritoStore.getScoreBoard({ listType, scoreType, year, month });
    const userScore = scoreList.filter((x) => x[listType] === user);

    const scoreTypeFilter = (scoreType === 'inc') ? 1 : -1;
    let countSwitch: any;
    let filteredData: any;

    if (listType === 'to' && scoreType === 'inc') {
        if (config.slack.enableDecrement) {
            filteredData = userScore;
        } else {
            filteredData = userScore.filter((e: any) => (e.value === scoreTypeFilter));
            countSwitch = 1;
        }
    } else {
        filteredData = userScore.filter((e: any) => (e.value === scoreTypeFilter));
        if (scoreType === 'dec') {
            countSwitch = 1;
        }
    }
    const userScoreCounted = filteredData.reduce((acc, item) => acc + (countSwitch || item.value), 0);
    const [res] = mapper([{
        _id: user,
        score: userScoreCounted,
    }]);
    return {
        ...res,
        scoreType,
        listType,
    };
};

export {
    getScoreBoard,
    getUserStats,
    givenBurritosToday,
    getUserScore,
};
