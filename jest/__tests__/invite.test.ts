/* eslint-disable max-len */

import {
  Colors,
} from 'discord.js';
import { stripIndents } from 'common-tags';
import { dInvite } from '../../src/discord/commands/global/d.invite';
import { executeCommandAndSpyReply, embedContaining, getParsedCommand } from '../utils/testutils';

const slashCommand = dInvite;

const authorInfo = {
  iconURL: 'https://fossdroid.com/images/icons/me.tripsit.tripmobile.13.png',
  name: 'TripSit.Me',
  url: 'http://www.tripsit.me',
};
const footerInfo = {
  iconURL: 'https://imgur.com/b923xK2.png',
  text: 'Dose responsibly!',
};

describe(slashCommand.data.name, () => {
  it(slashCommand.data.description, async () => {
    expect(await executeCommandAndSpyReply(
      slashCommand,
      getParsedCommand(
        `/${slashCommand.data.name}`,
        slashCommand.data,
        'tripsit',
      ),
    )).toHaveBeenCalledWith({
      embeds: embedContaining({
        author: authorInfo,
        footer: footerInfo,
        color: Colors.DarkBlue,
        title: 'Invite TripBot Dev',
        url: 'https://discord.com/api/oauth2/authorize?client_id=977945272359452713&permissions=18432&scope=bot%20applications.commands',
        description: stripIndents`
      This is a development version of the bot. Please use the production version for the best experience.

      [Click here to invite TripBot to your own server](https://discord.com/api/oauth2/authorize?client_id=977945272359452713&permissions=18432&scope=bot%20applications.commands).

      Note: For advanced features you will need to give the bot more permissions.

      The testing server is [TripSit Dev Discord](https://discord.gg/cNDsrMSY).
      If you have issues/questions, join and talk with Moonbear!`,
      }),
    });
  });
});
