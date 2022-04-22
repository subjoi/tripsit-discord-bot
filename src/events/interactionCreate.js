const fs = require('node:fs');
const { MessageEmbed } = require('discord.js');
const PREFIX = require('path').parse(__filename).name;
const logger = require('../utils/logger.js');
const Fuse = require('fuse.js');
const { getFirestore } = require('firebase-admin/firestore');
if (process.env.NODE_ENV !== 'production') {
    require('dotenv').config();
}
const ownerId = process.env.ownerId;
const guildId = process.env.guildId;
const channel_moderators_id = process.env.channel_moderators;
const ts_icon_url = process.env.ts_icon_url;

// const cooldown = new Set();
// // /This is 1 minute, you can change it to whatever value
// const cooldown_seconds = 1;
// const cooldownTime = cooldown_seconds * 1000;

const raw_drug_data = fs.readFileSync('./src/assets/allDrugData.json');
const allDrugData = JSON.parse(raw_drug_data);

module.exports = {
    name: 'interactionCreate',
    async execute(interaction, client) {
        // print what the user typed in the interaction
        logger.info(`[${PREFIX}] ${interaction.user.username} (${interaction.user.id}) started: ${interaction.message}`);

        // check if the user is a bot and if so, ignore it
        if (interaction.user.bot) {
            logger.debug(`[${PREFIX}] Ignoring bot interaction`);
            return;
        }
        const db = getFirestore();

        const snapshot = await db.collection('guilds').get();
        const blacklist_users = [];
        snapshot.forEach((doc) => {
            // logger.debug(`[${PREFIX}] ${doc.id}, '=>', ${doc.data()}`);
            if (doc.data().isBanned == true) {
                blacklist_users.push(doc.data().guild_id);
            }
        });

        // Check if the user is in blacklist_users and if so, ignore it
        logger.debug(`[${PREFIX}] blacklist_users: ${blacklist_users}`);
        if (blacklist_users.includes(interaction.user.id)) {
            logger.debug(`[${PREFIX}] ${interaction.user.username}#${interaction.user.discriminator} (${interaction.user.id}) is banned from using commands.`);
            return interaction.reply('You are banned from using commands.');
        }
        logger.debug(`[${PREFIX}] ${interaction.user.username} is not banned!`);

        // check if the interaction is a request for autocomplete
        if (interaction.isAutocomplete()) {
            const options = {
                shouldSort: true,
                keys: [
                    'name',
                    'aliasesStr',
                ],
            };

            // For each dictionary in the allDrugData list, find the "name" key and add it to a list
            const drugNames = allDrugData.map(d => d.name);
            // logger.debug(`[${PREFIX}] drugNames: ${drugNames}`);

            const fuse = new Fuse(drugNames, options);

            const focusedValue = interaction.options.getFocused();

            const results = fuse.search(focusedValue);
            // logger.debug(`[${PREFIX}] results: ${results}`);

            let top_25 = [];
            if (results.length > 0) {
                top_25 = results.slice(0, 25);
                // logger.debug(`[${PREFIX}] top_25: ${top_25}`);
                // for (const result of top_25) {
                // 	logger.debug(`[${PREFIX}] result: ${result.item}`);
                // }
                // await interaction.respond(
                //     top_25.map(choice => ({ name: choice.item, value: choice.item })),
                // );
                interaction.respond(
                    top_25.map(choice => ({ name: choice.item, value: choice.item })),
                );
            }
            else {
                const TOP_PSYCHS = ['Cannabis', 'MDMA', 'LSD', 'DMT', 'Mushrooms'];
                const TOP_DISSOS = ['Zolpidem', 'Ketamine', 'DXM', 'PCP', 'Salvia'];
                const TOP_OPIATE = ['Alcohol', 'Hydrocodone', 'Oxycodone', 'Tramadol', 'Heroin'];
                const TOP_BENZOS = ['Alprazolam', 'Clonazepam', 'Diazepam', 'Lorazepam', 'Flunitrazepam'];
                const TOP_SPEEDS = ['Nicotine', 'Amphetamine', 'Cocaine', 'Methamphetamine', 'Methylphenidate'];
                const TOP_DRUGS = TOP_PSYCHS.concat(TOP_DISSOS, TOP_OPIATE, TOP_BENZOS, TOP_SPEEDS);
                interaction.respond(
                    TOP_DRUGS.map(choice => ({ name: choice, value: choice })),
                );
            }
        }

        // check if the interaction is a button press
        if (interaction.isButton()) {
            const buttonID = interaction.customId;
            logger.debug(`[${PREFIX}] buttonID: ${buttonID}`);
            const command = client.commands.get(interaction.customId);
            logger.debug(`[${PREFIX}] command: ${command}`);
            const mod_chan = interaction.client.channels.cache.get(channel_moderators_id);

            if (buttonID == 'acknowledgebtn') {
                const embed = new MessageEmbed()
                    .setAuthor({ name: 'TripSit.Me ', url: 'http://www.tripsit.me', iconURL: ts_icon_url })
                    .setColor('GREEN')
                    .setDescription(`${interaction.user.username} has acknowledged their warning.`);
                mod_chan.send({ embeds: [embed] });
                interaction.reply('Thanks for understanding!');
            }

            if (buttonID == 'refusalbtn') {
                const guild = interaction.client.guilds.resolve(guildId);
                logger.debug(guild);
                guild.members.ban(interaction.user, { days: 7, reason: 'Refused warning' });
                const embed = new MessageEmbed()
                    .setAuthor({ name: 'TripSit.Me ', url: 'http://www.tripsit.me', iconURL: ts_icon_url })
                    .setColor('RED')
                    .setDescription(`${interaction.user.username} has refused their warning and was banned.`);
                mod_chan.send({ embeds: [embed] });
                interaction.reply('Thanks for making this easy!');
            }

            if (buttonID == 'guildacknowledgebtn') {
                // Get the owner of the client
                await interaction.client.application.fetch();
                const bot_owner = interaction.client.application.owner;
                logger.debug(`[${PREFIX}] bot_owner: ${bot_owner}`);
                const embed = new MessageEmbed()
                    .setAuthor({ name: 'TripSit.Me ', url: 'http://www.tripsit.me', iconURL: ts_icon_url })
                    .setColor('GREEN')
                    .setDescription(`${interaction.user.username} has acknowledged their warning.`);
                bot_owner.send({ embeds: [embed] });
                interaction.reply('Thanks for understanding!');
            }

            if (buttonID == 'warnbtn') {
                const embed = new MessageEmbed()
                    .setAuthor({ name: 'TripSit.Me ', url: 'http://www.tripsit.me', iconURL: ts_icon_url })
                    .setColor('RED')
                    .setDescription(`${interaction.user.username} has refused their warning and was banned.`);
                mod_chan.send({ embeds: [embed] });
                interaction.reply('Thanks for making this easy!');
            }

            if (!command) return;

            try {
                logger.debug(`[${PREFIX}] Executing command: ${command.name}`);
                command.execute(interaction);
            }
            catch (error) {
                logger.error(error);
                interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
            }
            return;
        }

        // // Cooldown logic
        // if (interaction.user.id !== ownerId) {
        //     if (cooldown.has(interaction.user.id)) {
        //     // / If the cooldown did not end
        //         interaction.reply({ content: 'Don\'t be a coconut ( ͡° ͜ʖ ͡°)', ephemeral: true });
        //         return;
        //     }
        //     else {
        //     // Set cooldown
        //         cooldown.add(interaction.user.id);
        //         setTimeout(() => {
        //         // Removes the user from the set after 1 minute
        //             cooldown.delete(interaction.user.id);
        //         }, cooldownTime);
        //     }
        // }

        // Failsafe to make sure only commands get past this point
        if (!interaction.isCommand()) return;
        logger.debug(`[${PREFIX}] isCommand`);

        const commandName = interaction.commandName;

        const command = client.commands.get(commandName);
        if (!command) return;

        const commands_admin = ['button', 'gban', 'gunban', 'uban', 'uunban', 'test', 'ping'];
        const commands_pm = ['idose'];

        // Check if the command is in commands_admin list and then check to see if the user is moonbear
        if (commands_admin.includes(commandName) && interaction.user.id !== ownerId) {
            interaction.reply({ content: 'You do not have permission to use this command.', ephemeral: true });
            return;
        }

        // Check if the command is in the commands_pm list and check if the command came in from a DM
        if (commands_pm.includes(commandName)) {
            if (interaction.inGuild() && interaction.user.id !== ownerId) {
                interaction.reply({ content: 'This command is only available in DMs.', ephemeral: true });
                return;
            }
        }

        try {
            command.execute(interaction);
        }
        catch (error) {
            logger.error(error);
            interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    },
};