const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;

// ─── Channel IDs ───────────────────────────────────────────────────────────────
const INFORMAL_CHANNEL_ID  = '1473037750713454712';
const BIZWAR_CHANNEL_ID    = '1472887381723058248';
const RPTICKET_CHANNEL_ID  = '1472887418138132550';
const RATINGS_CHANNEL_ID   = '1472887535997947934';
const FOUNDRY_CHANNEL_ID   = '1472887535997947934'; // same channel as ratings
const VINEYARD_CHANNEL_ID  = '1472887509502529708';
const NEWWEEK_CHANNEL_ID   = '1472898791580373032';

// ─── Roster storage ────────────────────────────────────────────────────────────
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
    new ButtonBuilder().setCustomId('informal_join').setLabel('✅ Join').setStyle(ButtonStyle.Success).setDisabled(closed),
    new ButtonBuilder().setCustomId('informal_leave').setLabel('❌ Leave').setStyle(ButtonStyle.Danger).setDisabled(closed)
  );

  return { embeds: [embed], components: [row] };
}

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED: builds a 25+10 roster embed
// ══════════════════════════════════════════════════════════════════════════════
function buildWarEmbed(name, customIdPrefix, mainRoster, subsRoster, createdAt, closeAt, closed = false) {
  const mainLines = [];
  for (let i = 1; i <= 25; i++) {
    const user = mainRoster[i - 1];
    mainLines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
  }

  const status   = closed ? '🔴 CLOSED' : '🟢 Open';
  const color    = closed ? 0xED4245 : 0x57F287;
  const title    = closed ? `🔒 ${name} (CLOSED)` : `✅ ${name}`;
  const closeStr = closeAt ? `\n**Auto closes:** ${formatTime(closeAt)} UK` : '';

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
    new ButtonBuilder().setCustomId(`${customIdPrefix}_join`).setLabel('✅ Join').setStyle(ButtonStyle.Success).setDisabled(closed),
    new ButtonBuilder().setCustomId(`${customIdPrefix}_leave`).setLabel('❌ Leave').setStyle(ButtonStyle.Danger).setDisabled(closed)
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
    const mainRoster = [], subsRoster = [], createdAt = new Date();
    const msg = await message.channel.send(buildWarEmbed('BizWar Roster', 'bizwar', mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'bizwar', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }

  if (message.content === '!rpticket') {
    const mainRoster = [], subsRoster = [], createdAt = new Date();
    const msg = await message.channel.send(buildWarEmbed('RP-Ticket Roster', 'rpticket', mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'rpticket', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }

  if (message.content === '!ratings') {
    const mainRoster = [], subsRoster = [], createdAt = new Date();
    const msg = await message.channel.send(buildWarEmbed('Ratings-Roster', 'ratings', mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'ratings', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }

  if (message.content === '!foundry') {
    const mainRoster = [], subsRoster = [], createdAt = new Date();
    const msg = await message.channel.send(buildWarEmbed('The Foundry-Roster', 'foundry', mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'foundry', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }

  if (message.content === '!vineyard') {
    const mainRoster = [], subsRoster = [], createdAt = new Date();
    const msg = await message.channel.send(buildWarEmbed('Vineyard-Roster', 'vineyard', mainRoster, subsRoster, createdAt, null));
    rosters.set(msg.id, { type: 'vineyard', mainRoster, subsRoster, closed: false, channelId: message.channel.id, createdAt });
    message.delete().catch(() => {});
  }
});

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED JOIN/LEAVE HANDLER
// ══════════════════════════════════════════════════════════════════════════════
async function handleWarJoin(interaction, data, rosterName, customIdPrefix) {
  const userId   = interaction.user.id;
  const username = interaction.user.username;
  const inMain   = data.mainRoster.find(u => u.id === userId);
  const inSubs   = data.subsRoster.find(u => u.id === userId);

  if (inMain || inSubs)
    return interaction.reply({ content: '⚠️ You\'re already on the roster!', ephemeral: true });

  if (data.mainRoster.length < 25) {
    data.mainRoster.push({ id: userId, username });
    await interaction.message.edit(buildWarEmbed(rosterName, customIdPrefix, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
    return interaction.reply({ content: '✅ Added to the **Main Roster**!', ephemeral: true });
  }

  if (data.subsRoster.length < 10) {
    data.subsRoster.push({ id: userId, username });
    await interaction.message.edit(buildWarEmbed(rosterName, customIdPrefix, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
    return interaction.reply({ content: '✅ Main roster is full — you\'ve been added to **Subs**!', ephemeral: true });
  }

  return interaction.reply({ content: '❌ Both the main roster and subs are full!', ephemeral: true });
}

async function handleWarLeave(interaction, data, rosterName, customIdPrefix) {
  const userId    = interaction.user.id;
  const mainIndex = data.mainRoster.findIndex(u => u.id === userId);
  const subsIndex = data.subsRoster.findIndex(u => u.id === userId);

  if (mainIndex === -1 && subsIndex === -1)
    return interaction.reply({ content: '⚠️ You\'re not on the roster.', ephemeral: true });

  if (mainIndex !== -1) data.mainRoster.splice(mainIndex, 1);
  else data.subsRoster.splice(subsIndex, 1);

  await interaction.message.edit(buildWarEmbed(rosterName, customIdPrefix, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, data.closed));
  return interaction.reply({ content: '✅ You\'ve been removed from the roster.', ephemeral: true });
}

// ══════════════════════════════════════════════════════════════════════════════
//  BUTTON INTERACTIONS
// ══════════════════════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isButton()) return;

  const data = rosters.get(interaction.message.id);
  if (!data)
    return interaction.reply({ content: '⚠️ This roster is no longer active.', ephemeral: true });

  if (data.closed)
    return interaction.reply({ content: '🔒 This roster is closed!', ephemeral: true });

  const userId   = interaction.user.id;
  const username = interaction.user.username;

  // ── INFORMAL ──
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

  // ── BIZWAR ──
  if (interaction.customId === 'bizwar_join')
    return handleWarJoin(interaction, data, 'BizWar Roster', 'bizwar');
  if (interaction.customId === 'bizwar_leave')
    return handleWarLeave(interaction, data, 'BizWar Roster', 'bizwar');

  // ── RP-TICKET ──
  if (interaction.customId === 'rpticket_join')
    return handleWarJoin(interaction, data, 'RP-Ticket Roster', 'rpticket');
  if (interaction.customId === 'rpticket_leave')
    return handleWarLeave(interaction, data, 'RP-Ticket Roster', 'rpticket');

  // ── RATINGS ──
  if (interaction.customId === 'ratings_join')
    return handleWarJoin(interaction, data, 'Ratings-Roster', 'ratings');
  if (interaction.customId === 'ratings_leave')
    return handleWarLeave(interaction, data, 'Ratings-Roster', 'ratings');

  // ── THE FOUNDRY ──
  if (interaction.customId === 'foundry_join')
    return handleWarJoin(interaction, data, 'The Foundry-Roster', 'foundry');
  if (interaction.customId === 'foundry_leave')
    return handleWarLeave(interaction, data, 'The Foundry-Roster', 'foundry');

  // ── VINEYARD ──
  if (interaction.customId === 'vineyard_join')
    return handleWarJoin(interaction, data, 'Vineyard-Roster', 'vineyard');
  if (interaction.customId === 'vineyard_leave')
    return handleWarLeave(interaction, data, 'Vineyard-Roster', 'vineyard');
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
      const nameMap = {
        bizwar:   'BizWar Roster',
        rpticket: 'RP-Ticket Roster',
        ratings:  'Ratings-Roster',
        foundry:  'The Foundry-Roster',
        vineyard: 'Vineyard-Roster',
      };
      await msg.edit(buildWarEmbed(nameMap[data.type], data.type, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, true));
    }
    console.log(`🔒 Closed roster ${msgId}`);
  } catch (e) {
    console.error('Failed to close roster:', e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULE HELPER — fires at next HH:MM UK, repeats daily
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

    setTimeout(() => { callback(); fire(); }, diffMs);
  };
  fire();
}

// ══════════════════════════════════════════════════════════════════════════════
//  POST HELPER — creates a roster and schedules its auto-close
// ══════════════════════════════════════════════════════════════════════════════
async function postWarRoster(channel, type, rosterName, customIdPrefix, closeHour, closeMinute) {
  const mainRoster = [], subsRoster = [];
  const createdAt  = new Date();

  const ukNow   = new Date(createdAt.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
  const closeAt = new Date(ukNow);
  closeAt.setHours(closeHour, closeMinute, 0, 0);

  const msg   = await channel.send(buildWarEmbed(rosterName, customIdPrefix, mainRoster, subsRoster, createdAt, closeAt));
  const msgId = msg.id;
  rosters.set(msgId, { type, mainRoster, subsRoster, closed: false, channelId: channel.id, createdAt, closeAt });
  console.log(`📋 ${rosterName} posted — closes at ${closeHour}:${String(closeMinute).padStart(2,'0')} UK`);

  const msUntilClose = closeAt - ukNow;
  setTimeout(() => closeRoster(msgId), msUntilClose);
}

// ══════════════════════════════════════════════════════════════════════════════
//  BOT READY
// ══════════════════════════════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  const informalChannel  = await client.channels.fetch(INFORMAL_CHANNEL_ID).catch(() => null);
  const bizwarChannel    = await client.channels.fetch(BIZWAR_CHANNEL_ID).catch(() => null);
  const rpticketChannel  = await client.channels.fetch(RPTICKET_CHANNEL_ID).catch(() => null);
  const ratingsChannel   = await client.channels.fetch(RATINGS_CHANNEL_ID).catch(() => null);
  const vineyardChannel  = await client.channels.fetch(VINEYARD_CHANNEL_ID).catch(() => null);
  const newweekChannel   = await client.channels.fetch(NEWWEEK_CHANNEL_ID).catch(() => null);
  // foundry uses same channel object as ratings

  if (!informalChannel)  console.error('❌ Cannot find informal channel');
  if (!bizwarChannel)    console.error('❌ Cannot find bizwar channel');
  if (!rpticketChannel)  console.error('❌ Cannot find rp-ticket channel');
  if (!ratingsChannel)   console.error('❌ Cannot find ratings/foundry channel');
  if (!vineyardChannel)  console.error('❌ Cannot find vineyard channel');
  if (!newweekChannel)   console.error('❌ Cannot find new week channel');

  // ── INFORMAL: every hour at :25 ──────────────────────────────────────────
  if (informalChannel) {
    const scheduleInformal = () => {
      const now  = new Date();
      const next = new Date();
      next.setMinutes(25, 0, 0);
      if (now.getMinutes() >= 25) next.setHours(next.getHours() + 1);
      const ms = next - now;
      console.log(`⏰ Next informal roster in ${Math.round(ms/1000/60)} min`);
      setTimeout(async () => {
        const mainRoster = [];
        const msg = await informalChannel.send(buildInformalEmbed(mainRoster, new Date()));
        rosters.set(msg.id, { type: 'informal', mainRoster, closed: false, channelId: informalChannel.id, createdAt: new Date() });
        console.log(`📋 Informal roster posted`);
        scheduleInformal();
      }, ms);
    };
    scheduleInformal();
  }

  // ── BIZWAR: 18:30 UK → 19:15 | 00:30 UK → 01:20 ─────────────────────────
  if (bizwarChannel) {
    scheduleDaily(18, 30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',     'bizwar',   19, 15));
    scheduleDaily(0,  30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',     'bizwar',   1,  20));
  }

  // ── RP-TICKET: 9:55 → 10:45 | 15:55 → 16:45 | 21:55 → 22:45 ────────────
  if (rpticketChannel) {
    scheduleDaily(9,  55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 10, 45));
    scheduleDaily(15, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 16, 45));
    scheduleDaily(21, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 22, 45));
  }

  // ── RATINGS: 20:10 UK → 21:10 ────────────────────────────────────────────
  // ── FOUNDRY: 13:50 UK → 14:50  (same channel) ────────────────────────────
  if (ratingsChannel) {
    scheduleDaily(20, 10, () => postWarRoster(ratingsChannel, 'ratings',  'Ratings-Roster',    'ratings',  21, 10));
    scheduleDaily(13, 50, () => postWarRoster(ratingsChannel, 'foundry',  'The Foundry-Roster', 'foundry',  14, 50));
  }

  // ── VINEYARD: 19:40 UK → 20:40 ───────────────────────────────────────────
  if (vineyardChannel) {
    scheduleDaily(19, 40, () => postWarRoster(vineyardChannel, 'vineyard', 'Vineyard-Roster', 'vineyard', 20, 40));
  }

  // ── NEW WEEK: every Monday at 04:00 UK ───────────────────────────────────
  if (newweekChannel) {
    const scheduleNewWeek = () => {
      const now    = new Date();
      const ukNow  = new Date(now.toLocaleString('en-GB', { timeZone: 'Europe/London' }));
      const target = new Date(ukNow);

      // Find next Monday
      const daysUntilMonday = (1 - ukNow.getDay() + 7) % 7 || 7; // 1 = Monday
      target.setDate(ukNow.getDate() + daysUntilMonday);
      target.setHours(4, 0, 0, 0);

      // If it's already Monday and before 4AM, post today
      if (ukNow.getDay() === 1 && ukNow.getHours() < 4) {
        target.setDate(ukNow.getDate());
      }

      const diffMs = target - ukNow;
      console.log(`⏰ [NEW WEEK] fires in ${Math.round(diffMs/1000/60/60)} hours`);

      setTimeout(async () => {
        await newweekChannel.send('-------------------------------------------- NEW WEEK --------------------------------------------');
        console.log('📅 New week message sent');
        scheduleNewWeek(); // reschedule for next Monday
      }, diffMs);
    };
    scheduleNewWeek();
  }
});

client.login(TOKEN);
