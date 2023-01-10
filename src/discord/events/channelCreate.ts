import {
  TextChannel,
} from 'discord.js';
import {
  AuditLogEvent,
} from 'discord-api-types/v10';
import {
  ChannelCreateEvent,
} from '../@types/eventDef';
// const F= f(__filename);

// https://discordjs.guide/popular-topics/audit-logs.html#who-deleted-a-message

export default channelCreate;

export const channelCreate: ChannelCreateEvent = {
  name: 'channelCreate',
  async execute(channel) {
    // Only run on Tripsit, we don't want to snoop on other guilds ( ͡~ ͜ʖ ͡°)
    if (channel.guild.id !== env.DISCORD_GUILD_ID) return;

    const fetchedLogs = await channel.guild.fetchAuditLogs({
      limit: 1,
      type: AuditLogEvent.ChannelCreate,
    });

    const creationLog = fetchedLogs.entries.first();

    const auditlog = await client.channels.fetch(env.CHANNEL_AUDITLOG) as TextChannel;

    // Perform a coherence check to make sure that there's *something*
    if (!creationLog) {
      await auditlog.send(`Channel ${channel.name} was created, but no relevant audit logs were found.`);
      return;
    }

    const response = creationLog.executor
      ? `Channel ${channel.name} was created by ${creationLog.executor.tag}.`
      : `Channel ${channel.name} was created, but the audit log was inconclusive.`;

    await auditlog.send(response);
  },
};
