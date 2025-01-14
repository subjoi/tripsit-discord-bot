import {
  TextChannel,
} from 'discord.js';
import {
  GuildDeleteEvent,
} from '../@types/eventDef';
import { db } from '../../global/utils/knex';
import { DiscordGuilds } from '../../global/@types/pgdb';

const F = f(__filename);

export default guildDelete;

export const guildDelete: GuildDeleteEvent = {
  name: 'guildDelete',
  async execute(guild) {
    log.info(F, `Left guild: ${guild.name} (id: ${guild.id})`);
    await db<DiscordGuilds>('discord_guilds')
      .insert({
        id: guild.id,
        removed_at: new Date(),
      })
      .onConflict('id')
      .merge();

    if (guild.id === '1026942722612924518') return;

    const auditlog = await client.channels.fetch(env.CHANNEL_AUDITLOG) as TextChannel;
    client.guilds.fetch();
    await auditlog.send(`I just left a guild! I am now in ${client.guilds.cache.size} guilds!
      ${guild.name} (id: ${guild.id})
      Member count: ${guild.memberCount}
      Description: ${guild.description ? guild.description : 'No description'}
    `);
  },
};
