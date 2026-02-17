const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;

// Channel to auto-post the roster in
const AUTO_POST_CHANNEL_ID = '1473037750713454712';

// Store: messageId -> { roster: [], channelId, createdAt }
const rosters = new Map();

// Build the embed + buttons
function buildRosterMessage(roster, createdAt) {
  const maxSlots = 10;
  const lines = [];

  for (let i = 1; i <= maxSlots; i++) {
    const user = roster[i - 1];
    lines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
  }

  const now = new Date();
  const dateStr = now.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  const timeStr = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

  const embed = new EmbedBuilder()
    .setTitle('✅ Informal Roster (First 10 Only)')
    .setDescription(
      `**Main Roster (1–10)**\n${lines.join('\n')}\n\n` +
      `✅ Join | ❌ Leave • Status: 🟢 Open • Created: ${dateStr} • ${timeStr} UK`
    )
    .setColor(0x57F287);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('roster_join').setLabel('✅ Join').setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('roster_leave').setLabel('❌ Leave').setStyle(ButtonStyle.Danger)
  );

  return { embeds: [embed], components: [row] };
}

// Command: !roster
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!roster') {
    const roster = [];
    const msg = await message.channel.send(buildRosterMessage(roster, new Date()));
    rosters.set(msg.id, { roster, channelId: message.channel.id, createdAt: new Date() });
    // Delete the command message to keep chat clean
    message.delete().catch(() => {});
  }
});

// Button interactions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const data = rosters.get(interaction.message.id);
  if (!data) {
    return interaction.reply({ content: '⚠️ This roster is no longer active.', ephemeral: true });
  }

  const userId = interaction.user.id;
  const username = interaction.user.username;

  if (interaction.customId === 'roster_join') {
    const alreadyIn = data.roster.find(u => u.id === userId);
    if (alreadyIn) {
      return interaction.reply({ content: '⚠️ You\'re already on the roster!', ephemeral: true });
    }
    if (data.roster.length >= 10) {
      return interaction.reply({ content: '❌ The roster is full (10/10)!', ephemeral: true });
    }
    data.roster.push({ id: userId, username });
    await interaction.message.edit(buildRosterMessage(data.roster, data.createdAt));
    return interaction.reply({ content: '✅ You\'ve been added to the roster!', ephemeral: true });
  }

  if (interaction.customId === 'roster_leave') {
    const index = data.roster.findIndex(u => u.id === userId);
    if (index === -1) {
      return interaction.reply({ content: '⚠️ You\'re not on the roster.', ephemeral: true });
    }
    data.roster.splice(index, 1);
    await interaction.message.edit(buildRosterMessage(data.roster, data.createdAt));
    return interaction.reply({ content: '✅ You\'ve been removed from the roster.', ephemeral: true });
  }
});

client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  const channel = await client.channels.fetch(AUTO_POST_CHANNEL_ID);
  if (!channel) {
    console.error('❌ Could not find the auto-post channel!');
    return;
  }

  // Auto-post a fresh roster every 30 seconds
  // To switch to "every hour at :25" later, replace this with a cron job
  setInterval(async () => {
    const roster = [];
    const msg = await channel.send(buildRosterMessage(roster, new Date()));
    rosters.set(msg.id, { roster, channelId: channel.id, createdAt: new Date() });
    console.log(`📋 Auto-posted new roster at ${new Date().toLocaleTimeString('en-GB')}`);
  }, 30 * 1000); // 30,000ms = 30 seconds
});

client.login(TOKEN);