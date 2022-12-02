import {
  SlashCommandBuilder,
} from 'discord.js';
import { parse } from 'path';
import { stripIndents } from 'common-tags';
import { SlashCommand } from '../../@types/commandDef';
import { embedTemplate } from '../../utils/embedTemplate';
import { ems } from '../../../global/commands/g.ems';
import { startLog } from '../../utils/startLog';
// import log from '../../../global/utils/log';
const PREFIX = parse(__filename).name;

export default dEms;

export const dEms: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('ems')
    .setDescription('Information that may be helpful in a serious situation.'),
  async execute(interaction) {
    startLog(PREFIX, interaction);
    const emsInfo = await ems();
    const embed = embedTemplate();

    embed.setTitle('EMS Information');
    // for (const entry of emsInfo) {
    emsInfo.forEach(entry => {
      const country = `(${entry.country})`;
      const website = `\n[Website](${entry.website})`;
      const webchat = `\n[Webchat](${entry.website})`;
      const phone = `\nCall: ${entry.phone}`;
      const text = `\nText: ${entry.text}`;
      embed.addFields(
        {
          name: `${entry.name} ${entry.country ? country : ''}`,
          value: stripIndents`${entry.website ? website : ''}\
            ${entry.webchat ? webchat : ''}\
            ${entry.phone ? phone : ''}\
            ${entry.text ? text : ''}`,
          inline: true,
        },
      );
    });
    interaction.reply({ embeds: [embed] });
    return true;
  },
};