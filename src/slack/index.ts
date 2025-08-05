import * as log from 'bog';
import { WebClient } from '@slack/web-api';
import { RTMClient } from '@slack/rtm-api';
import { App } from '@slack/bolt';
import { RTMMock, WebMock } from '../../test/lib/slackMock';
import config from '../config';

const { slackMock } = config.misc;

log.debug('Slack mockApi loaded', slackMock);

export default {
    rtm: slackMock ? new RTMMock() : new RTMClient(config.slack.api_token),
    wbc: slackMock ? new WebMock() : new WebClient(config.slack.api_token),
};

export const boltApp = new App({
    token: config.slack.api_token,
    signingSecret: config.slack.signing_secret,
    appToken: config.slack.app_token,
    socketMode: true,
});
