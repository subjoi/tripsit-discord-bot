/* eslint-disable max-len */

import {
  SlashCommandBuilder,
  Colors,
} from 'discord.js';
import { stripIndents } from 'common-tags';
import { SlashCommand } from '../../@types/commandDef';
import { embedTemplate } from '../../utils/embedTemplate';
import { invite } from '../../../global/commands/g.invite';
import { startLog } from '../../utils/startLog';

const F = f(__filename);

export default dInvite;

export const dInvite: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('invite')
    .setDescription('Shows an invite link for this bot!'),
  async execute(interaction) {
    startLog(F, interaction);
    const inviteInfo = await invite();
    const isProd = process.env.NODE_ENV === 'production';
    const devNotice = process.env.NODE_ENV === 'production'
      ? ''
      : 'This is a development version of the bot. Please use the production version for the best experience.';
    const botname = isProd
      ? 'TripBot'
      : 'TripBot Dev';
    const guildname = isProd
      ? 'TripSit'
      : 'TripSit Dev';
    const embed = embedTemplate()
      .setColor(Colors.DarkBlue)
      .setTitle(`Invite ${botname}`)
      .setURL(inviteInfo.bot)
      .setDescription(stripIndents`
        ${devNotice}

        [Click here to invite TripBot to your own server](${inviteInfo.bot}).

        Note: For advanced features you will need to give the bot more permissions.

        The ${isProd ? 'official support' : 'testing'} server is [${guildname} Discord](${inviteInfo.discord}).
        If you have issues/questions, join and talk with Moonbear!
      `);
    interaction.reply({ embeds: [embed] });
    return true;
  },
};
