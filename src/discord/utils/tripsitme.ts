/* eslint-disable max-len */
import {
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  ButtonBuilder,
  ModalSubmitInteraction,
  TextChannel,
  Colors,
  GuildMember,
  Role,
  ThreadChannel,
  ButtonInteraction,
  Message,
  MessageReaction,
  User,
  // ChatInputCommandInteraction,
  PermissionsBitField,
  // TextChannel,
  // MessageFlags,
  MessageMentionTypes,
  ChatInputCommandInteraction,
} from 'discord.js';
import {
  TextInputStyle,
  ChannelType,
  ButtonStyle,
} from 'discord-api-types/v10';
import { stripIndents } from 'common-tags';
import {
  db,
  getGuild,
  getOpenTicket,
  getUser,
} from '../../global/utils/knex';
import {
  Users,
  UserTickets,
  TicketStatus,
} from '../../global/@types/pgdb.d';
import { startLog } from './startLog';
import { embedTemplate } from './embedTemplate';

const F = f(__filename);

const teamRoles = [
  env.ROLE_DIRECTOR,
  env.ROLE_SUCCESSOR,
  env.ROLE_SYSADMIN,
  env.ROLE_LEADDEV,
  env.ROLE_IRCADMIN,
  env.ROLE_DISCORDADMIN,
  env.ROLE_IRCOP,
  env.ROLE_MODERATOR,
  env.ROLE_TRIPSITTER,
  env.ROLE_TEAMTRIPSIT,
  env.ROLE_TRIPBOT2,
  env.ROLE_TRIPBOT,
  env.ROLE_BOT,
  env.ROLE_DEVELOPER,
];

const colorRoles = [
  env.ROLE_TREE,
  env.ROLE_SPROUT,
  env.ROLE_SEEDLING,
  env.ROLE_BOOSTER,
  env.ROLE_RED,
  env.ROLE_ORANGE,
  env.ROLE_YELLOW,
  env.ROLE_GREEN,
  env.ROLE_BLUE,
  env.ROLE_PURPLE,
  env.ROLE_PINK,
  // env.ROLE_BROWN,
  env.ROLE_BLACK,
  env.ROLE_WHITE,
];

const mindsetRoles = [
  env.ROLE_DRUNK,
  env.ROLE_HIGH,
  env.ROLE_ROLLING,
  env.ROLE_TRIPPING,
  env.ROLE_DISSOCIATING,
  env.ROLE_STIMMING,
  env.ROLE_SEDATED,
  env.ROLE_SOBER,
];

// const otherRoles = [
//   env.ROLE_VERIFIED,
// ];

const ignoredRoles = `${teamRoles},${colorRoles},${mindsetRoles}`;

const guildOnly = 'This must be performed in a guild!';
const memberOnly = 'This must be performed by a member of a guild!';

/**
 * Applies the NeedHelp role on a user and removes their other roles
 * @param {GuildMember} interaction
 * @param {GuildMember} target
 * */
export async function needsHelpmode(
  interaction: ModalSubmitInteraction | ButtonInteraction | ChatInputCommandInteraction,
  target: GuildMember,
) {
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.reply(memberOnly);
    return;
  }

  const guildData = await getGuild(interaction.guild.id);

  let roleNeedshelp = {} as Role;
  if (guildData.role_needshelp) {
    roleNeedshelp = await interaction.guild.roles.fetch(guildData.role_needshelp) as Role;
  }

  // Save the user's roles to the DB
  target.fetch();
  const targetRoleIds = target.roles.cache.map(role => role.id);
  // log.debug(F, `targetRoleIds: ${targetRoleIds}`);
  await db<Users>('users')
    .insert({
      discord_id: target.id,
      roles: targetRoleIds.toString(),
    })
    .onConflict('discord_id')
    .merge();

  const myMember = await interaction.guild.members.fetch(interaction.client.user.id);
  const myRole = myMember.roles.highest;
  // Remove all roles, except team and vanity, from the target
  target.roles.cache.forEach(async role => {
    // log.debug(F, `role: ${role.name} - ${role.id}`);
    if (!ignoredRoles.includes(role.id)
    && !role.name.includes('@everyone')
    && role.id !== roleNeedshelp.id
    && role.comparePositionTo(myRole)) {
      await target.roles.remove(role);
    }
  });

  // Add the needsHelp role to the target
  try {
    // log.debug(F, `Adding role ${roleNeedshelp.name} to ${target.displayName}`);
    await target.roles.add(roleNeedshelp);
  } catch (err) {
    log.error(F, `Error adding role to target: ${err}`);
    await interaction.reply(stripIndents`There was an error adding the NeedsHelp role!
      Make sure the bot's role is higher than NeedsHelp in the Role list!`);
  }
}

/**
 * Handles the Own button
 * @param {ButtonInteraction} interaction
 * */
export async function tripsitmeOwned(
  interaction:ButtonInteraction,
) {
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  // log.debug(F, `tripsitmeOwned`);
  const userId = interaction.customId.split('~')[1];
  const actor = interaction.member as GuildMember;

  const target = await interaction.guild.members.fetch(userId);

  const userData = await getUser(userId, null);
  const ticketData = await getOpenTicket(userData.id, null);

  // log.debug(F, `ticketData: ${JSON.stringify(ticketData, null, 2)}`);

  if (!ticketData) {
    const rejectMessage = `Hey ${interaction.member}, ${target.displayName} not have an open session!`;
    const embed = embedTemplate().setColor(Colors.DarkBlue);
    embed.setDescription(rejectMessage);
    // log.debug(F, `target ${target} does not need help!`);
    if (interaction.deferred) {
      await interaction.editReply({ embeds: [embed] });
    } else {
      await interaction.reply({ embeds: [embed] });
    }
    return;
  }

  const metaChannelId = ticketData?.meta_thread_id ?? env.CHANNEL_TRIPSITMETA;
  const metaChannel = await interaction.guild.channels.fetch(metaChannelId) as TextChannel;
  await metaChannel.send({
    content: stripIndents`${actor.displayName} has indicated that ${target.toString()} is receiving help!`,
  });
  if (metaChannelId !== env.CHANNEL_TRIPSITMETA) {
    metaChannel.setName(`💛│${target.displayName}'s discussion!`);
  }

  // Update the ticket's name
  const channel = await interaction.guild.channels.fetch(ticketData.thread_id) as TextChannel;
  channel.setName(`💛│${target.displayName}'s channel!`);

  // Update the ticket's status in the DB
  ticketData.status = 'OWNED' as TicketStatus;
  await db<UserTickets>('user_tickets')
    .update(ticketData)
    .where('id', ticketData.id);

  // Reply to the user
  await interaction.reply({ content: 'Thanks!', ephemeral: true });
}

/**
 * Handles the Meta Thread button
 * @param {ButtonInteraction} interaction
 * */
export async function tripsitmeMeta(
  interaction:ButtonInteraction,
) {
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  // log.debug(F, `tripsitmeMeta`);
  const userId = interaction.customId.split('~')[1];
  const actor = interaction.member as GuildMember;
  const target = await interaction.guild.members.fetch(userId);

  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  if (!interaction.channel) {
    // log.debug(F, `no channel!`);
    await interaction.reply('This must be performed in a channel!');
    return;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.reply('This must be performed by a member!');
    return;
  }

  const userData = await getUser(userId, null);
  const ticketData = await getOpenTicket(userData.id, null);

  if (!ticketData) {
    const rejectMessage = `Hey ${interaction.member}, ${target.displayName} not have an open session!`;
    const embed = embedTemplate().setColor(Colors.DarkBlue);
    embed.setDescription(rejectMessage);
    // log.debug(F, `target ${target} does not need help!`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const channel = interaction.channel as TextChannel;
  const metaChannel = await channel.threads.create(
    {
      name: `💛│${target.displayName}'s discussion!`,
      autoArchiveDuration: 1440,
      type: interaction.guild.premiumTier > 2 ? ChannelType.PrivateThread : ChannelType.PublicThread,
      reason: `${actor.displayName} created meta thread for ${target.displayName}`,
    },
  );

  ticketData.meta_thread_id = metaChannel.id;

  await db<UserTickets>('user_tickets')
    .insert(ticketData)
    .onConflict('id')
    .merge();

  // Send an embed to the meta room
  const embedTripsitter = embedTemplate()
    .setColor(Colors.DarkBlue)
    .setDescription(stripIndents`
      ${actor.toString()} has created a meta thread for ${target.toString()}!

      ${ticketData.description}

      **Read the log before interacting**
      Use this channel coordinate efforts.

      **No one is qualified to handle suicidal users here**
      If the user is considering / talking about suicide, direct them to the suicide hotline!

      **Do not engage in DM**
      Keep things in the open where you have the team's support!
      `)
    .setFooter({ text: 'If you need help click the Backup button to summon Helpers and Tripsitters' });

  const endSession = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`tripsitmeOwned~${target.id}`)
        .setLabel('Owned')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tripsitmeClose~${target.id}`)
        .setLabel('They\'re good now!')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tripsitmeBackup~${target.id}`)
        .setLabel('I need backup')
        .setStyle(ButtonStyle.Danger),
    );

  await metaChannel.send({
    embeds: [embedTripsitter],
    components: [endSession],
    allowedMentions: {},
  });

  await interaction.reply({ content: 'Donezo!', ephemeral: true });
}

/**
 * Handles the Backup button
 * @param {ButtonInteraction} interaction
 * */
export async function tripsitmeBackup(
  interaction:ButtonInteraction,
) {
  // log.debug(F, `tripsitmeBackup`);
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  if (!interaction.channel) {
    // log.debug(F, `no channel!`);
    await interaction.reply('This must be performed in a channel!');
    return;
  }
  const userId = interaction.customId.split('~')[1];
  const actor = interaction.member as GuildMember;
  const target = await interaction.guild.members.fetch(userId);

  const userData = await getUser(userId, null);
  const ticketData = await getOpenTicket(userData.id, null);

  if (!ticketData) {
    const rejectMessage = `Hey ${interaction.member}, ${target.displayName} not have an open session!`;
    const embed = embedTemplate().setColor(Colors.DarkBlue);
    embed.setDescription(rejectMessage);
    // log.debug(F, `target ${target} does not need help!`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  const guildData = await getGuild(interaction.guild.id);

  let backupMessage = 'Hey ';
  // Get the roles we'll be referencing
  let roleTripsitter = {} as Role;
  let roleHelper = {} as Role;
  if (guildData.role_tripsitter) {
    roleTripsitter = await interaction.guild.roles.fetch(guildData.role_tripsitter) as Role;
    backupMessage += `<@&${roleTripsitter.id}> `;
  }
  if (guildData.role_helper) {
    roleHelper = await interaction.guild.roles.fetch(guildData.role_helper) as Role;
    backupMessage += `and/or <@&${roleHelper.id}> `;
  }

  backupMessage += stripIndents`team, ${actor} has inidicated they could use some backup!
    
  Be sure to read the log so you have the context!`;

  if (ticketData.meta_thread_id) {
    const metaThread = await interaction.guild.channels.fetch(ticketData.meta_thread_id) as ThreadChannel;
    await metaThread.send(backupMessage);
  } else {
    await interaction.channel.send(backupMessage);
  }

  await interaction.reply({ content: 'Backup message sent!', ephemeral: true });
}

/**
 * Handles removing of the NeedsHelp mode
 * @param {ButtonInteraction} interaction
 */
export async function tripsitmeClose(
  interaction:ButtonInteraction,
) {
  startLog(F, interaction);
  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.editReply(guildOnly);
    return;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.editReply(memberOnly);
    return;
  }

  // log.debug(F, `tripsitmeClose`);
  // log.debug(F, `interaction.customId: ${interaction.customId}`);

  const targetId = interaction.customId.split('~')[1];

  // log.debug(F, `targetId: ${targetId}`);

  // const guildData = await getGuild(interaction.guild.id);

  // let roleNeedshelp = {} as Role;
  // let channelTripsitmeta = {} as TextChannel;
  // if (guildData.role_needshelp) {
  //   roleNeedshelp = await interaction.guild.roles.fetch(guildData.role_needshelp) as Role;
  // }
  // if (guildData.channel_tripsitmeta) {
  //   channelTripsitmeta = await interaction.guild.channels.fetch(guildData.channel_tripsitmeta) as TextChannel;
  // }

  const target = await interaction.guild.members.fetch(targetId);
  const actor = interaction.member as GuildMember;

  // log.debug(F, `actor.id: ${actor.id}`);

  if (targetId === actor.id) {
    // log.debug(F, `not the target!`);
    await interaction.editReply({ content: 'You should not be able to see this button!' });
    return;
  }

  const userData = await getUser(target.id, null);
  const ticketData = await getOpenTicket(userData.id, null);

  // log.debug(F, `ticketData: ${JSON.stringify(ticketData, null, 2)}`);

  if (!ticketData) {
    const rejectMessage = `Hey ${interaction.member}, ${target.displayName} not have an open session!`;
    const embed = embedTemplate().setColor(Colors.DarkBlue);
    embed.setDescription(rejectMessage);
    // log.debug(F, `target ${target} does not need help!`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Get the channel objects for the help thread
  let threadHelpUser = {} as ThreadChannel;
  try {
    threadHelpUser = await interaction.guild.channels.fetch(ticketData.thread_id) as ThreadChannel;
    threadHelpUser.setName(`💙│${target.displayName}'s channel!`);
  } catch (err) {
    // log.debug(F, `There was an error updating the help thread, it was likely deleted:\n ${err}`);
    // Update the ticket status to closed
    ticketData.status = 'DELETED' as TicketStatus;
    await db<UserTickets>('user_tickets')
      .insert(ticketData)
      .onConflict('id')
      .merge();
  // log.debug(F, `Updated ticket status to DELETED`);
  }

  const closeMessage = stripIndents`Hey ${target}, it looks like you're doing somewhat better!
    This thread will remain here for a day if you want to follow up tomorrow.
    After 7 days, or on request, it will be deleted to preserve your privacy =)
    If you'd like to go back to social mode, just click the button below!
    `;

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`tripsitmeResolve~${target.id}`)
        .setLabel('I\'m good now!')
        .setStyle(ButtonStyle.Success),
    );

  await threadHelpUser.send({
    content: closeMessage,
    components: [row],
  });

  const metaChannelId = ticketData?.meta_thread_id ?? env.CHANNEL_TRIPSITMETA;
  const metaChannel = await interaction.guild.channels.fetch(metaChannelId) as TextChannel;
  await metaChannel.send({
    content: stripIndents`${actor.displayName} has indicated that ${target.toString()} no longer needs help!`,
  });
  if (metaChannelId !== env.CHANNEL_TRIPSITMETA) {
    metaChannel.setName(`💙│${target.displayName}'s discussion!`);
  }

  // Update the ticket status to closed
  ticketData.status = 'CLOSED' as TicketStatus;
  await db<UserTickets>('user_tickets')
    .insert(ticketData)
    .onConflict('id')
    .merge();

  // log.debug(F, `${target.user.tag} (${target.user.id}) is no longer being helped!`);
  await interaction.editReply({ content: 'Done!' });
}

/**
 * Handles removing of the NeedsHelp mode
 * @param {ButtonInteraction} interaction
 */
export async function tripsitmeResolve(
  interaction:ButtonInteraction,
) {
  startLog(F, interaction);
  if (interaction.channel
      && (interaction.channel as ThreadChannel).archived) {
    await (interaction.channel as ThreadChannel).setArchived(false);
  }

  await interaction.deferReply({ ephemeral: true });
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.editReply(guildOnly);
    return;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.editReply(memberOnly);
    return;
  }

  // log.debug(F, `interaction.customId: ${interaction.customId}`);
  const targetId = interaction.customId.split('~')[1];
  // log.debug(F, `targetId: ${targetId}`);
  const override = interaction.customId.split('~')[0] === 'tripsitmodeOffOverride';
  // log.debug(F, `override: ${override}`);

  const target = await interaction.guild.members.fetch(targetId);
  const actor = interaction.member as GuildMember;

  log.debug(F, `${interaction.deferred} ${interaction.replied} ${interaction.ephemeral}`);

  if (targetId !== actor.id && !override) {
    // log.debug(F, `not the target!`);
    await interaction.editReply({ content: 'Only the user receiving help can click this button!' });
    return;
  }

  let roleNeedshelp = {} as Role;
  let channelTripsitmeta = {} as TextChannel;
  const guildData = await getGuild(interaction.guild.id);
  if (guildData.role_needshelp) {
    roleNeedshelp = await interaction.guild.roles.fetch(guildData.role_needshelp) as Role;
  }
  if (guildData.channel_tripsitmeta) {
    channelTripsitmeta = await interaction.guild.channels.fetch(guildData.channel_tripsitmeta) as TextChannel;
  }

  const userData = await getUser(target.id, null);

  if (userData.roles) {
    const myMember = await interaction.guild.members.fetch(interaction.client.user.id);
    const myRole = myMember.roles.highest;
    const targetRoles:string[] = userData.roles.split(',') || [];

    if (roleNeedshelp && roleNeedshelp.comparePositionTo(myRole) < 0) {
      // log.debug(F, `Removing ${roleNeedshelp.name} from ${target.displayName}`);
      await target.roles.remove(roleNeedshelp);
    }

    // readd each role to the target
    if (targetRoles) {
      targetRoles.forEach(async roleId => {
        // log.debug(F, `Re-adding roleId: ${roleId}`);
        if (!interaction.guild) {
          log.error(F, 'no guild!');
          return;
        }
        const roleObj = await interaction.guild.roles.fetch(roleId) as Role;
        if (roleObj
          && !ignoredRoles.includes(roleObj.id)
          && roleObj.name !== '@everyone'
          && roleObj.id !== roleNeedshelp.id
          && roleObj.comparePositionTo(myRole) < 0) {
          await target.roles.add(roleObj);
        }
      });
    }
  }

  // log.debug(F, `targetLastHelpedThreadId: ${targetLastHelpedThreadId}`);

  const ticketData = await getOpenTicket(userData.id, null);

  // log.debug(F, `ticketData: ${JSON.stringify(ticketData, null, 2)}`);

  if (ticketData === undefined || Object.entries(ticketData).length === 0) {
    const rejectMessage = `Hey ${interaction.member}, you do not have an open session!`;
    const embed = embedTemplate().setColor(Colors.DarkBlue);
    embed.setDescription(rejectMessage);
    // log.debug(F, `target ${target} does not need help!`);
    await interaction.editReply({ embeds: [embed] });
    return;
  }

  // Get the channel objects for the help thread
  let threadHelpUser = {} as ThreadChannel;
  try {
    threadHelpUser = await interaction.guild.channels.fetch(ticketData.thread_id) as ThreadChannel;
    threadHelpUser.setName(`💚│${target.displayName}'s channel!`);
  } catch (err) {
    // log.debug(F, `There was an error updating the help thread, it was likely deleted:\n ${err}`);
    // Update the ticket status to closed
    ticketData.status = 'DELETED' as TicketStatus;
    await db<UserTickets>('user_tickets')
      .insert(ticketData)
      .onConflict('id')
      .merge();
  // log.debug(F, `Updated ticket status to DELETED`);
  }

  const endHelpMessage = stripIndents`Hey ${target}, we're glad you're doing better!
    We've restored your old roles back to normal <3
    This thread will remain here for a day if you want to follow up tomorrow.
    After 7 days, or on request, it will be deleted to preserve your privacy =)`;

  try {
    await threadHelpUser.send(endHelpMessage);
  } catch (err) {
    log.error(F, `Error sending end help message to ${threadHelpUser}`);
    log.error(F, err as string);
  }

  let message:Message;
  await threadHelpUser.send(stripIndents`
      ${env.EMOJI_INVISIBLE}
      > **If you have a minute, your feedback is important to us!**
      > Please rate your experience with ${interaction.guild.name}'s service by reacting below.
      > Thank you!
      ${env.EMOJI_INVISIBLE}
      `)
    .then(async msg => {
      message = msg;
      await msg.react('🙁');
      await msg.react('😕');
      await msg.react('😐');
      await msg.react('🙂');
      await msg.react('😁');

      // Setup the reaction collector
      const filter = (reaction:MessageReaction, user:User) => user.id === target.id;
      const collector = message.createReactionCollector({ filter, time: 1000 * 60 * 60 * 24 });
      collector.on('collect', async reaction => {
        await threadHelpUser.send(stripIndents`
          ${env.EMOJI_INVISIBLE}
          > Thank you for your feedback, here's a cookie! 🍪
          ${env.EMOJI_INVISIBLE}
          `);
        // log.debug(F, `Collected ${reaction.emoji.name} from ${threadHelpUser}`);
        const finalEmbed = embedTemplate()
          .setColor(Colors.Blue)
          .setDescription(`Collected ${reaction.emoji.name} from ${threadHelpUser}`);
        try {
          await channelTripsitmeta.send({ embeds: [finalEmbed] });
        } catch (err) {
          // log.debug(F, `Failed to send message, am i still in the tripsit guild?`);
        }
        msg.delete();
        collector.stop();
      });
    });

  let metaChannelId = ticketData?.meta_thread_id;
  if (metaChannelId === null && interaction.guild.id === env.GUILD_TRIPSIT) {
    metaChannelId = env.CHANNEL_TRIPSITMETA;
  }
  if (metaChannelId !== null) {
    const metaChannel = await interaction.guild.channels.fetch(metaChannelId) as TextChannel;
    await metaChannel.send({
      content: stripIndents`${actor.displayName} has indicated that they no longer need help!`,
    });
    if (metaChannelId !== env.CHANNEL_TRIPSITMETA) {
      metaChannel.setName(`💚│${target.displayName}'s discussion!`);
    }
  }

  // Update the ticket status to resolved
  ticketData.status = 'RESOLVED' as TicketStatus;
  await db<UserTickets>('user_tickets')
    .insert(ticketData)
    .onConflict('id')
    .merge();

  // log.debug(F, `${target.user.tag} (${target.user.id}) is no longer being helped!`);
  await interaction.editReply({ content: 'Done!' });
}

/**
 * Creates the tripsit modal
 * @param {ButtonInteraction} interaction The interaction that initialized this
 * @param {GuildMember} memberInput The member being aced upon
 * @param {string} triage Given triage information
 * @param {string} intro Given intro information
 */
export async function tripSitMe(
  interaction:ModalSubmitInteraction,
  memberInput:GuildMember | null,
  triage:string,
  intro:string,
):Promise<ThreadChannel | null> {
  await startLog('tripSitMe', interaction);

  // Lookup guild information for variables
  if (!interaction.guild) {
    await interaction.reply({ content: 'This command can only be used in a server!', ephemeral: true });
    return null;
  }
  const actor = interaction.member;
  const guildData = await getGuild(interaction.guild.id);

  // let backupMessage = 'Hey ';
  // Get the roles we'll be referencing
  let roleTripsitter = {} as Role;
  let roleHelper = {} as Role;
  let channelTripsitmeta = {} as TextChannel;
  if (guildData.role_tripsitter) {
    roleTripsitter = await interaction.guild.roles.fetch(guildData.role_tripsitter) as Role;
    // backupMessage += `<@&${roleTripsitter.id}> `;
  }
  if (guildData.role_helper) {
    roleHelper = await interaction.guild.roles.fetch(guildData.role_helper) as Role;
    // backupMessage += `<@&${roleHelper.id}> `;
  }
  if (guildData.channel_tripsitmeta) {
    channelTripsitmeta = await interaction.guild.channels.fetch(guildData.channel_tripsitmeta) as TextChannel;
  }

  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return null;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.reply(memberOnly);
    return null;
  }

  // log.debug(F, `submitted with |
  //   user: ${interaction.user.tag} (${interaction.user.id})
  //   guild: ${interaction.guild.name} (${interaction.guild.id})
  //   memberInput: ${memberInput}
  //   roleTripsitterId: ${roleTripsitter.id}
  //   channelTripsittersId: ${channelTripsitmeta.id}
  //   triage: ${triage}
  //   intro: ${intro}
  // `);

  // Determine if this command was initialized by an Admin (for testing)
  const actorIsAdmin = (actor as GuildMember).permissions.has(PermissionsBitField.Flags.Administrator);
  const showMentions = actorIsAdmin ? [] : ['users', 'roles'] as MessageMentionTypes[];
  // log.debug(F, `actorIsAdmin: ${actorIsAdmin}`);
  // log.debug(F, `showMentions: ${showMentions}`);

  // Determine the target.
  // If the user clicked the button, the target is whoever initialized the interaction.
  // Otherwise, the target is the user mentioned in the /tripsit command.
  // log.debug(F, `memberInput: ${JSON.stringify(memberInput, null, 2)}`);
  // log.debug(F, `interaction.member: ${JSON.stringify(interaction.member, null, 2)}`);
  const target = (memberInput ?? interaction.member) as GuildMember;
  // log.debug(F, `target: ${target}`);

  await needsHelpmode(interaction, target);

  // Get the tripsit channel from the guild
  const tripsitChannel = guildData.channel_tripsit
    ? await interaction.guild.channels.fetch(guildData.channel_tripsit) as TextChannel
    : {} as TextChannel;

  if (!tripsitChannel.id) {
    // log.debug(F, `no tripsit channel!`);
    await interaction.reply({ content: 'No tripsit channel found! Make sure to run /setup tripsit', ephemeral: true });
    return null;
  }
  // Create a new private thread in the channel
  // If we're not in production we need to create a public thread
  const threadHelpUser = await tripsitChannel.threads.create({
    name: `🧡│${target.displayName}'s channel!`,
    autoArchiveDuration: 1440,
    type: interaction.guild.premiumTier > 2 ? ChannelType.PrivateThread : ChannelType.PublicThread,
    reason: `${target.displayName} requested help`,
  });

  const noInfo = '\n*No info given*';
  const firstMessage = stripIndents`
      Hey ${target}, thank you for asking for assistance!

      You've taken: ${triage ? `\n${triage}` : noInfo}

      Your issue: ${intro ? `\n${intro}` : noInfo}

      Someone from the ${roleTripsitter} ${guildData.role_helper ? `and/or ${roleHelper}` : ''} team will be with you as soon as they're available!
      If this is a medical emergency please contact your local /EMS: we do not call EMS on behalf of anyone.
      When you're feeling better you can use the "I'm Good" button to let the team know you're okay.
      If you just would like someone to talk to, check out the warmline directory: https://warmline.org/warmdir.html#directory
      `;

  const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`tripsitmeResolve~${target.id}`)
        .setLabel('I\'m good now!')
        .setStyle(ButtonStyle.Success),
    );
  await threadHelpUser.send({
    content: firstMessage,
    components: [row],
    allowedMentions: {
      parse: showMentions,
    },
    flags: ['SuppressEmbeds'],
  }).then(message => {
    message.pin();
  });

  // log.debug(F, `Sent intro message to ${threadHelpUser.name} ${threadHelpUser.id}`);

  // Send an embed to the tripsitter room
  const embedTripsitter = embedTemplate()
    .setColor(Colors.DarkBlue)
    .setDescription(stripIndents`
      ${target} has requested assistance!
      **They've taken:** ${triage ? `${triage}` : noInfo}
      **Their issue: ** ${intro ? `${intro}` : noInfo}

      **Read the log before interacting**
      Use this channel coordinate efforts.

      **No one is qualified to handle suicidal users here**
      If the user is considering / talking about suicide, direct them to the suicide hotline!

      **Do not engage in DM**
      Keep things in the open where you have the team's support!
      `)
    .setFooter({ text: 'If you need help click the Backup button to summon Helpers and Tripsitters' });

  const endSession = new ActionRowBuilder<ButtonBuilder>()
    .addComponents(
      new ButtonBuilder()
        .setCustomId(`tripsitmeOwned~${target.id}`)
        .setLabel('Owned')
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`tripsitmeClose~${target.id}`)
        .setLabel('They\'re good now!')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`tripsitmeMeta~${target.id}`)
        .setLabel('Create thread')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`tripsitmeBackup~${target.id}`)
        .setLabel('I need backup')
        .setStyle(ButtonStyle.Danger),
    );

  await channelTripsitmeta.send({
    embeds: [embedTripsitter],
    components: [endSession],
    allowedMentions: {},
  });
  // log.debug(F, `Sent message to ${channelTripsitmeta.name} (${channelTripsitmeta.id})`);

  const threadArchiveTime = new Date();
  // define one week in milliseconds
  // const thirtySec = 1000 * 30;
  const tenMins = 1000 * 60 * 10;
  const oneDay = 1000 * 60 * 60 * 24;
  const archiveTime = env.NODE_ENV === 'production'
    ? threadArchiveTime.getTime() + oneDay
    : threadArchiveTime.getTime() + tenMins;
  threadArchiveTime.setTime(archiveTime);
  // log.debug(F, `threadArchiveTime: ${threadArchiveTime}`);

  const userData = await getUser(target.id, null);

  // Set ticket information
  const introStr = intro ? `\n${intro}` : noInfo;
  const newTicketData = {
    user_id: userData.id,
    description: `
    They've taken: ${triage ? `\n${triage}` : noInfo}

    Their issue: ${introStr}`,
    thread_id: threadHelpUser.id,
    type: 'TRIPSIT',
    status: 'OPEN',
    first_message_id: '',
    archived_at: threadArchiveTime,
    deleted_at: new Date(threadArchiveTime.getTime() + 1000 * 60 * 60 * 24 * 7),
  } as UserTickets;

  // log.debug(F, `newTicketData: ${JSON.stringify(newTicketData, null, 2)}`);

  // Update thet ticket in the DB
  await db<UserTickets>('user_tickets')
    .insert(newTicketData);

  return threadHelpUser;
}

/**
 * Handles the tripsit button
 * @param {ButtonInteraction} interaction
 */
export async function tripsitmeButton(
  interaction:ButtonInteraction,
) {
  startLog(F, interaction);
  if (!interaction.guild) {
    // log.debug(F, `no guild!`);
    await interaction.reply(guildOnly);
    return;
  }
  if (!interaction.member) {
    // log.debug(F, `no member!`);
    await interaction.reply(memberOnly);
    return;
  }
  const target = interaction.member as GuildMember;

  // log.debug(F, `target: ${JSON.stringify(target, null, 2)}`);

  const actorIsAdmin = target.permissions.has(PermissionsBitField.Flags.Administrator);
  const showMentions = actorIsAdmin ? [] : ['users', 'roles'] as MessageMentionTypes[];

  // const guildData = await getGuild(interaction.guild.id) as DiscordGuilds;

  // Get the roles we'll be referencing
  // let roleTripsitter = {} as Role;
  // let roleHelper = {} as Role;
  // if (guildData.role_tripsitter) {
  //   roleTripsitter = await interaction.guild.roles.fetch(guildData.role_tripsitter) as Role;
  // }
  // if (guildData.role_helper) {
  //   roleHelper = await interaction.guild.roles.fetch(guildData.role_helper) as Role;
  // }

  // Team check - Cannot be run on team members
  // If this user is a developer then this is a test run and ignore this check,
  // but we'll change the output down below to make it clear this is a test.
  let targetIsTeamMember = false;
  if (!actorIsAdmin) {
    target.roles.cache.forEach(async role => {
      if (teamRoles.includes(role.id)) {
        targetIsTeamMember = true;
      }
    });
    if (targetIsTeamMember) {
      // log.debug(F, `Target is a team member!`);
      const teamMessage = stripIndents`You are a member of the team and cannot be publicly helped!`;
      const embed = embedTemplate()
        .setColor(Colors.DarkBlue)
        .setDescription(teamMessage);
      if (!interaction.replied) {
        await interaction.reply({ embeds: [embed], ephemeral: true });
      }
      return;
    }
  }

  const userData = await getUser(target.id, null);

  const ticketData = await getOpenTicket(userData.id, null);

  // log.debug(F, `Target ticket data: ${JSON.stringify(ticketData, null, 2)}`);

  if (ticketData !== undefined) {
    // log.debug(F, `Target has open ticket: ${JSON.stringify(ticketData, null, 2)}`);

    let threadHelpUser = {} as ThreadChannel;
    try {
      threadHelpUser = await interaction.guild.channels.fetch(ticketData.thread_id) as ThreadChannel;
    } catch (err) {
    // log.debug(F, `There was an error updating the help thread, it was likely deleted`);
      // Update the ticket status to closed
      ticketData.status = 'DELETED' as TicketStatus;
      await db<UserTickets>('user_tickets')
        .insert(ticketData)
        .onConflict('id')
        .merge();
    // log.debug(F, `Updated ticket status to DELETED`);
    // log.debug(F, `Ticket: ${JSON.stringify(ticketData, null, 2)}`);
    }

    if (threadHelpUser.id) {
      await needsHelpmode(interaction, target);
      const guildData = await getGuild(interaction.guild.id);

      let roleTripsitter = {} as Role;
      let roleHelper = {} as Role;
      if (guildData.role_tripsitter) {
        roleTripsitter = await interaction.guild.roles.fetch(guildData.role_tripsitter) as Role;
      }
      if (guildData.role_helper) {
        roleHelper = await interaction.guild.roles.fetch(guildData.role_helper) as Role;
      }

      // Remind the user that they have a channel open
      // const recipient = '' as string;

      const embed = embedTemplate()
        .setColor(Colors.DarkBlue)
        .setDescription(stripIndents`Hey ${interaction.member}, you have an open session!
  
        Check your channel list or click '${threadHelpUser.toString()} to get help!`);
      await interaction.reply({ embeds: [embed], ephemeral: true });
      // log.debug(F, `Rejected need for help`);

      // Check if the created_by is in the last 5 minutes
      const createdDate = new Date(ticketData.reopened_at ?? ticketData.created_at);
      const now = new Date();
      const diff = now.getTime() - createdDate.getTime();
      const minutes = Math.floor(diff / 1000 / 60);

      // Send the update message to the thread
      let helpMessage = stripIndents`Hey ${target}, thanks for asking for help, we can continue talking here! What's up?`;
      if (minutes > 5) {
        const helperStr = `and/or ${roleHelper}`;
        // log.debug(F, `Target has open ticket, and it was created over 5 minutes ago!`);
        helpMessage += `\n\nSomeone from the ${roleTripsitter} ${guildData.role_helper ? helperStr : ''} team will be with you as soon as they're available!`;
      }
      await threadHelpUser.send({
        content: helpMessage,
        allowedMentions: {
          parse: showMentions,
        },
      });
      // log.debug(F, `Pinged user in help thread`);

      if (ticketData.meta_thread_id) {
        let metaMessage = '';
        if (minutes > 5) {
          const helperString = `and/or ${roleHelper}`;
          metaMessage = `Hey ${roleTripsitter} ${guildData.role_helper ?? helperString} team, ${target.toString()} has indicated they need assistance!`;
        } else {
          metaMessage = `${target.toString()} has indicated they need assistance!`;
        }
        const metaThread = await interaction.guild.channels.fetch(ticketData.meta_thread_id) as ThreadChannel;
        metaThread.setName(`💛│${target.displayName}'s discussion!`);
        await metaThread.send({
          content: metaMessage,
          allowedMentions: {
            parse: showMentions,
          },
        });
        // log.debug(F, `Pinged team in meta thread!`);
      }
      return;
    }
  }

  const modal = new ModalBuilder()
    .setCustomId(`tripsitmeSubmit~${interaction.id}`)
    .setTitle('Tripsitter Help Request');
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
    .setCustomId('triageInput')
    .setLabel('What substance? How much taken? How long ago?')
    .setStyle(TextInputStyle.Short)));
  modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(new TextInputBuilder()
    .setCustomId('introInput')
    .setLabel('What\'s going on? Give us the details!')
    .setStyle(TextInputStyle.Paragraph)));
  await interaction.showModal(modal);

  const filter = (i:ModalSubmitInteraction) => i.customId.startsWith('tripsitmeSubmit');
  await interaction.awaitModalSubmit({ filter, time: 0 })
    .then(async i => {
      if (i.customId.split('~')[1] !== interaction.id) return;
      const triage = i.fields.getTextInputValue('triageInput');
      const intro = i.fields.getTextInputValue('introInput');

      const threadHelpUser = await tripSitMe(i, target, triage, intro) as ThreadChannel;

      const replyMessage = stripIndents`
      Hey ${target}, thank you for asking for assistance!
      
      Click here to be taken to your private room: ${threadHelpUser.toString()}
  
      You can also click in your channel list to see your private room!`;
      const embed = embedTemplate()
        .setColor(Colors.DarkBlue)
        .setDescription(replyMessage);
      try {
        await i.reply({ embeds: [embed], ephemeral: true });
      } catch (err) {
        log.error(F, `There was an error responding to the user! ${err}`);
      }
    });
}
