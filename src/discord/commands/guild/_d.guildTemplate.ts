/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  Colors,
  SlashCommandBuilder,
  TextChannel,
  ModalSubmitInteraction,
} from 'discord.js';
import {
  TextInputStyle,
} from 'discord-api-types/v10';
import { SlashCommand } from '../../@types/commandDef';
import { embedTemplate } from '../../utils/embedTemplate';
import { globalTemplate } from '../../../global/commands/_g.template';
import { startLog } from '../../utils/startLog';

const F = f(__filename);

export default dTemplate;

export const dTemplate: SlashCommand = {
  data: new SlashCommandBuilder()
    .setName('template')
    .setDescription('Example!'),
  async execute(interaction) {
    startLog(F, interaction);
    // Create the modal
    const modal = new ModalBuilder()
      .setCustomId(`modal~${interaction.id}`)
      .setTitle('Modal');
    const modalInput = new TextInputBuilder()
      .setCustomId('modalInput')
      .setLabel('Input')
      .setStyle(TextInputStyle.Paragraph);
    const firstActionRow = new ActionRowBuilder<TextInputBuilder>().addComponents(modalInput);
    modal.addComponents(firstActionRow);
    await interaction.showModal(modal);
    // log.debug(F, `displayed modal!`);
    const filter = (i:ModalSubmitInteraction) => i.customId.includes('feedbackReportModal');
    const submitted = await interaction.awaitModalSubmit({ filter, time: 0 });
    if (submitted) {
      if (submitted.customId.split('~')[1] !== interaction.id) return true;
      const input = submitted.fields.getTextInputValue('modalInput');
      // log.debug(F, `input: ${input}`);
    }
    return true;
  },
};
