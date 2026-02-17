const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;

// ─── Channel IDs ───────────────────────────────────────────────────────────────
const INFORMAL_CHANNEL_ID = '1473037750713454712';
const BIZWAR_CHANNEL_ID   = '1472887381723058248';

// ─── Roster storage ────────────────────────────────────────────────────────────
// messageId -> { type, mainRoster, subsRoster, closed, channelId, createdAt, closeAt }
const rosters = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

// ══════════════════════════════════════════════════════════════════════════════
//  INFORMAL ROSTER  (10 slots, no subs)
// ══════════════════════════════════════════════════════════════════════════════
function buildInformalEmbed(mainRoster, createdAt, closed = false) {
  const lines = [];
  for (let i = 1; i <= 10; i++) {
    const user = mainRoster[i - 1];
    lines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
  }

  const status = closed ? '🔴 CLOSED' : '🟢 Open';
  const color  = closed ? 0xED4245 : 0x57F287;

  const embed = new EmbedBuilder()
    .setTitle(closed ? '🔒 Informal Roster (CLOSED)' : '✅ Informal Roster (First 10 Only)')
    .setDescription(
      `**Main Roster (1–10)**\n${lines.join('\n')}\n\n` +
      `Status: ${status} • Created: ${formatDate(createdAt)} • ${formatTime(createdAt)} UK`
    )
    .setColor(color);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('informal_join')
      .setLabel('✅ Join')
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId('informal_leave')
      .setLabel('❌ Leave')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed)
  );

  return { embeds: [embed], components: [row] };
}

// ══════════════════════════════════════════════════════════════════════════════
//  BIZWAR ROSTER  (25 main + 10 subs shown once main is full)
// ══════════════════════════════════════════════════════════════════════════════
function buildBizWarEmbed(mainRoster, subsRoster, createdAt, closeAt, closed = false) {
  // Main roster lines (always 25 slots shown)
  const mainLines = [];
  for (let i = 1; i <= 25; i++) {
    const user = mainRoster[i - 1];
    mainLines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
  }

  const status = closed ? '🔴 CLOSED' : '🟢 Open';
  const color  = closed ? 0xED4245 : 0x57F287;
  const title  = closed ? '🔒 BizWar Roster (CLOSED)' : '✅ BizWar Roster';
  const closeStr = closeAt ? `\n**Auto closes:** ${formatTime(closeAt)} UK` : '';

  // Subs section — only shown once main is full (25/25)
  let subsSection = '';
  if (mainRoster.length >= 25) {
    const subLines = [];
    for (let i = 1; i <= 10; i++) {
      const user = subsRoster[i - 1];
      subLines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
    }
    subsSection = `\n\n**Subs Roster**\n${subLines.join('\n')}`;
  } else {
    subsSection = `\n\n**Subs Roster**\n*Opens when main roster is full (25/25)*`;
  }

  const embed = new EmbedBuilder()
    .setTitle(title)
    .setDescription(
      `**Status:** ${status}\n` +
      `**Created:** ${formatDate(createdAt)} • ${formatTime(createdAt)} UK` +
      closeStr + `\n\n` +
      `**Main Roster (1–25)**\n${mainLines.join('\n')}` +
      subsSection
    )
    .setColor(color);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('bizwar_join')
      .setLabel('✅ Join')
      .setStyle(ButtonStyle.Success)
      .setDisabled(closed),
    new ButtonBuilder()
      .setCustomId('bizwar_leave')
      .setLabel('❌ Leave')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(closed)
  );

  return { embeds: [embed], components: [row] };
}

// ══════════════════════════════════════════════════════════════════════════════
//  MANUAL COMMANDS
// ══════════════════════════════════════════════════════════════════════════════
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  if (message.content === '!roster') {
    const mainRoster = [];
    const msg = await message.channel.send(buildInformalEmbed(mainRoster, new Date()));
    rosters.set(msg.id, { type: 'informal', mainRoster, closed: false, channelId: message.channel.id, createdAt: new Date() });
    message.delete().catch(() => {});
  }

  if (message.content === '!bizwar') {
    const mainRoster = [];
    const subsRoster = [];
    const createdAt  = new Date();
    const msg = await message.channel.send(buildBizWarEmbed(mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'bizwar', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  BUTTON INTERACTIONS
// ══════════════════════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const data = rosters.get(interaction.message.id);
  if (!data) {
    return interaction.reply({ content: '⚠️ This roster is no longer active.', ephemeral: true });
  }

  if (data.closed) {
    return interaction.reply({ content: '🔒 This roster is closed!', ephemeral: true });
  }

  const userId   = interaction.user.id;
  const username = interaction.user.username;

  // ── INFORMAL ──────────────────────────────────────────────────────────────
  if (interaction.customId === 'informal_join') {
    if (data.mainRoster.find(u => u.id === userId))
      return interaction.reply({ content: '⚠️ You\'re already on the roster!', ephemeral: true });
    if (data.mainRoster.length >= 10)
      return interaction.reply({ content: '❌ The roster is full (10/10)!', ephemeral: true });
    data.mainRoster.push({ id: userId, username });
    await interaction.message.edit(buildInformalEmbed(data.mainRoster, data.createdAt, data.closed));
    return interaction.reply({ content: '✅ You\'ve been added to the roster!', ephemeral: true });
  }

  if (interaction.customId === 'informal_leave') {
    const index = data.mainRoster.findIndex(u => u.id === userId);
    if (index === -1)
      return interaction.reply({ content: '⚠️ You\'re not on the roster.', ephemeral: true });
    data.mainRoster.splice(index, 1);
    await interaction.message.edit(buildInformalEmbed(data.mainRoster, data.createdAt, data.closed));
    return interaction.reply({ content: '✅ You\'ve been removed from the roster.', ephemeral: true });
  }

  // ── BIZWAR ────────────────────────────────────────────────────────────────
  if (interaction.customId === 'bizwar_join') {
    const inMain = data.mainRoster.find(u => u.id === userId);
    const inSubs = data.subsRoster.find(u => u.id === userId);

    if (inMain || inSubs)
      return interaction.reply({ content: '⚠️ You\'re already on the roster!', ephemeral: true });

    // Main still has space
    if (data.mainRoster.length < 25) {
      data.mainRoster.push({ id: userId, username });
      await interaction.message.edit(buildBizWarEmbed(data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
      return interaction.reply({ content: '✅ Added to the **Main Roster**!', ephemeral: true });
    }

    // Main is full — join subs
    if (data.subsRoster.length < 10) {
      data.subsRoster.push({ id: userId, username });
      await interaction.message.edit(buildBizWarEmbed(data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
      return interaction.reply({ content: '✅ Main roster is full — you\'ve been added to **Subs**!', ephemeral: true });
    }

    return interaction.reply({ content: '❌ Both the main roster and subs are full!', ephemeral: true });
  }

  if (interaction.customId === 'bizwar_leave') {
    const mainIndex = data.mainRoster.findIndex(u => u.id === userId);
    const subsIndex = data.subsRoster.findIndex(u => u.id === userId);

    if (mainIndex === -1 && subsIndex === -1)
      return interaction.reply({ content: '⚠️ You\'re not on the roster.', ephemeral: true });

    if (mainIndex !== -1) {
      data.mainRoster.splice(mainIndex, 1);
    } else {
      data.subsRoster.splice(subsIndex, 1);
    }

    await interaction.message.edit(buildBizWarEmbed(data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
    return interaction.reply({ content: '✅ You\'ve been removed from the roster.', ephemeral: true });
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  CLOSE ROSTER
// ══════════════════════════════════════════════════════════════════════════════
async function closeRoster(msgId) {
  const data = rosters.get(msgId);
  if (!data || data.closed) return;
  data.closed = true;

  try {
    const ch  = await client.channels.fetch(data.channelId);
    const msg = await ch.messages.fetch(msgId);
    if (data.type === 'informal') {
      await msg.edit(buildInformalEmbed(data.mainRoster, data.createdAt, true));
    } else {
      await msg.edit(buildBizWarEmbed(data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, true));
    }
    console.log(`🔒 Closed roster ${msgId}`);
  } catch (e) {
    console.error('Failed to close roster:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULE HELPER — fires callback at next HH:MM UK time, repeats daily
// ══════════════════════════════════════════════════════════════════════════════
function scheduleDaily(hour, minute, callback) {
  const fire = () => {
    const now    = new Date();
    const ukNow  = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
    const target = new Date(ukNow);
    target.setHours(hour, minute, 0, 0);
    if (ukNow >= target) target.setDate(target.getDate() + 1);

    const diffMs = target - ukNow;
    console.log(`⏰ [${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UK] fires in ${Math.round(diffMs/1000/60)} min`);

    setTimeout(() => {
      callback();
      fire(); // reschedule for next day
    }, diffMs);
  };
  fire();
}

// ══════════════════════════════════════════════════════════════════════════════
//  BOT READY
// ══════════════════════════════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  const informalChannel = await client.channels.fetch(INFORMAL_CHANNEL_ID).catch(() => null);
  const bizwarChannel   = await client.channels.fetch(BIZWAR_CHANNEL_ID).catch(() => null);

  if (!informalChannel) console.error('❌ Cannot find informal channel');
  if (!bizwarChannel)   console.error('❌ Cannot find bizwar channel');

  // ── INFORMAL: every hour at :25 ──────────────────────────────────────────
  if (informalChannel) {
    const postInformal = async () => {
      const mainRoster = [];
      const msg = await informalChannel.send(buildInformalEmbed(mainRoster, new Date()));
      rosters.set(msg.id, { type: 'informal', mainRoster, closed: false, channelId: informalChannel.id, createdAt: new Date() });
      console.log(`📋 Informal roster posted`);
    };

    const scheduleInformal = () => {
      const now  = new Date();
      const next = new Date();
      next.setMinutes(25, 0, 0);
      if (now.getMinutes() >= 25) next.setHours(next.getHours() + 1);
      const ms = next - now;
      console.log(`⏰ Next informal roster in ${Math.round(ms/1000/60)} min`);
      setTimeout(async () => { await postInformal(); scheduleInformal(); }, ms);
    };
    scheduleInformal();
  }

  // ── BIZWAR: 18:30 UK (closes 19:15) and 00:30 UK (closes 01:20) ──────────
  if (bizwarChannel) {
    const postBizWar = async (closeHour, closeMinute) => {
      const mainRoster = [];
      const subsRoster = [];
      const createdAt  = new Date();

      const ukNow  = new Date(createdAt.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
      const closeAt = new Date(ukNow);
      closeAt.setHours(closeHour, closeMinute, 0, 0);

      const msg   = await bizwarChannel.send(buildBizWarEmbed(mainRoster, subsRoster, createdAt, closeAt));
      const msgId = msg.id;
      rosters.set(msgId, { type: 'bizwar', mainRoster, subsRoster, closed: false, channelId: bizwarChannel.id, createdAt, closeAt });
      console.log(`📋 BizWar roster posted — closes at ${closeHour}:${String(closeMinute).padStart(2,'0')} UK`);

      // Auto-close after the right delay
      const msUntilClose = closeAt - ukNow;
      setTimeout(() => closeRoster(msgId), msUntilClose);
    };

    scheduleDaily(18, 30, () => postBizWar(19, 15));
    scheduleDaily(0,  30, () => postBizWar(1,  20));
  }
});

client.login(TOKEN);
