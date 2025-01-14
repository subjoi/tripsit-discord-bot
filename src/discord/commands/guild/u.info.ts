import {
  ContextMenuCommandBuilder,
  GuildMember,
} from 'discord.js';
import {
  ApplicationCommandType,
} from 'discord-api-types/v10';
import { UserCommand } from '../../@types/commandDef';
// import log from '../../../global/utils/log';
import { moderate } from '../../../global/commands/g.moderate';
import { startLog } from '../../utils/startLog';

const F = f(__filename);

export default uInfo;

export const uInfo: UserCommand = {
  data: new ContextMenuCommandBuilder()
    .setName('Info')
    .setType(ApplicationCommandType.User),
  async execute(interaction) {
    startLog(F, interaction);
    await interaction.deferReply({ ephemeral: true });
    const actor = interaction.member as GuildMember;
    const target = interaction.options.data[0].member as GuildMember;

    const result = await moderate(
      actor,
      'INFO',
      target,
      null,
      null,
      null,
    );

    // log.debug(F, `Result: ${result}`);
    await interaction.editReply(result);

    return true;
  },
};
