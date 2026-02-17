const { Client, GatewayIntentBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder } = require('discord.js');

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent]
});

const TOKEN = process.env.TOKEN;

// ─── Channel IDs ───────────────────────────────────────────────────────────────
const INFORMAL_CHANNEL_ID = '1473037750713454712';
const BIZWAR_CHANNEL_ID   = '1472887381723058248';
const RPTICKET_CHANNEL_ID = '1472887418138132550';
const RATINGS_CHANNEL_ID  = '1472887535997947934'; // also used for The Foundry
const VINEYARD_CHANNEL_ID = '1472887509502529708';
const NEWWEEK_CHANNEL_ID  = '1472898791580373032';

// ─── Roster storage ────────────────────────────────────────────────────────────
const rosters = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────
// Always display times in UK timezone (handles both GMT and BST automatically)
function formatDate(date) {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
}

// Returns current time as a real Date, and current UK time components
function getUKTime() {
  const now = new Date();
  const ukStr = now.toLocaleString('en-US', { timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit' });
  // ukStr format: "MM/DD/YYYY, HH:MM:SS"
  const [datePart, timePart] = ukStr.split(', ');
  const [month, day, year]   = datePart.split('/').map(Number);
  const [hour, minute, second] = timePart.split(':').map(Number);
  return { now, year, month, day, hour, minute, second, dayOfWeek: new Date(year, month - 1, day).getDay() };
}

// ══════════════════════════════════════════════════════════════════════════════
//  INFORMAL ROSTER  (10 slots, no subs, no auto-close)
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
//  SHARED: builds a 25 main + 10 subs roster embed
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

  let subsSection;
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
//  SHARED JOIN/LEAVE HANDLERS
// ══════════════════════════════════════════════════════════════════════════════
async function handleWarJoin(interaction, data, rosterName, customIdPrefix) {
  const userId   = interaction.user.id;
  const username = interaction.user.username;

  if (data.mainRoster.find(u => u.id === userId) || data.subsRoster.find(u => u.id === userId))
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
//  CLOSE ROSTER — marks closed, edits embed red, disables buttons
// ══════════════════════════════════════════════════════════════════════════════
const nameMap = {
  bizwar:   'BizWar Roster',
  rpticket: 'RP-Ticket Roster',
  ratings:  'Ratings-Roster',
  foundry:  'The Foundry-Roster',
  vineyard: 'Vineyard-Roster',
};

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
      await msg.edit(buildWarEmbed(nameMap[data.type], data.type, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, true));
    }
    console.log(`🔒 Closed roster ${msgId} (${data.type})`);
  } catch (e) {
    console.error(`Failed to close roster ${msgId}:`, e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULE HELPER — fires callback at HH:MM UK time, repeats daily
//  Uses real UTC math with Europe/London offset to handle GMT/BST automatically
// ══════════════════════════════════════════════════════════════════════════════
function scheduleDaily(hour, minute, callback) {
  const fire = async () => {
    const now = new Date();

    // Get current UK time components
    const uk = getUKTime();

    // Build a UTC Date that represents "today HH:MM UK"
    // by computing how many ms until that UK time
    const todayUKMidnightUTC = Date.UTC(uk.year, uk.month - 1, uk.day, 0, 0, 0, 0);
    // UK offset in ms (handles BST/GMT automatically via getUKTime)
    const ukOffsetMs = todayUKMidnightUTC - new Date(uk.year, uk.month - 1, uk.day, 0, 0, 0, 0).getTime();
    // Actually easier: just compute seconds since UK midnight
    const ukSecondsNow = uk.hour * 3600 + uk.minute * 60 + uk.second;
    const targetSeconds = hour * 3600 + minute * 60;

    let diffSeconds = targetSeconds - ukSecondsNow;
    if (diffSeconds <= 0) diffSeconds += 86400; // push to tomorrow if already passed

    const diffMs = diffSeconds * 1000;
    console.log(`⏰ [${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UK] fires in ${Math.round(diffMs/1000/60)} min`);

    setTimeout(async () => {
      try { await callback(); } catch (e) { console.error('Schedule callback error:', e.message); }
      fire(); // reschedule for next day
    }, diffMs);
  };
  fire();
}

// ══════════════════════════════════════════════════════════════════════════════
//  POST HELPER — posts a war roster and schedules its auto-close
// ══════════════════════════════════════════════════════════════════════════════
async function postWarRoster(channel, type, rosterName, customIdPrefix, closeHour, closeMinute) {
  const mainRoster = [], subsRoster = [];
  const createdAt = new Date();

  // Build closeAt as a real UTC Date representing closeHour:closeMinute UK time today
  const uk = getUKTime();
  const ukSecondsNow   = uk.hour * 3600 + uk.minute * 60 + uk.second;
  const closeSeconds   = closeHour * 3600 + closeMinute * 60;
  let   diffToCloseMs  = (closeSeconds - ukSecondsNow) * 1000;
  if (diffToCloseMs <= 0) diffToCloseMs += 86400 * 1000; // next day if already passed

  // closeAt is used for display only — we store it as a Date offset from now
  const closeAt = new Date(createdAt.getTime() + diffToCloseMs);

  const msg   = await channel.send(buildWarEmbed(rosterName, customIdPrefix, mainRoster, subsRoster, createdAt, closeAt));
  const msgId = msg.id;
  rosters.set(msgId, { type, mainRoster, subsRoster, closed: false, channelId: channel.id, createdAt, closeAt });
  console.log(`📋 ${rosterName} posted — closes in ${Math.round(diffToCloseMs/1000/60)} min`);

  setTimeout(() => closeRoster(msgId), diffToCloseMs);
}

// ══════════════════════════════════════════════════════════════════════════════
//  BOT READY
// ══════════════════════════════════════════════════════════════════════════════
client.once('ready', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  const informalChannel = await client.channels.fetch(INFORMAL_CHANNEL_ID).catch(() => null);
  const bizwarChannel   = await client.channels.fetch(BIZWAR_CHANNEL_ID).catch(() => null);
  const rpticketChannel = await client.channels.fetch(RPTICKET_CHANNEL_ID).catch(() => null);
  const ratingsChannel  = await client.channels.fetch(RATINGS_CHANNEL_ID).catch(() => null); // also used for foundry
  const vineyardChannel = await client.channels.fetch(VINEYARD_CHANNEL_ID).catch(() => null);
  const newweekChannel  = await client.channels.fetch(NEWWEEK_CHANNEL_ID).catch(() => null);

  if (!informalChannel) console.error('❌ Cannot find informal channel');
  if (!bizwarChannel)   console.error('❌ Cannot find bizwar channel');
  if (!rpticketChannel) console.error('❌ Cannot find rp-ticket channel');
  if (!ratingsChannel)  console.error('❌ Cannot find ratings/foundry channel');
  if (!vineyardChannel) console.error('❌ Cannot find vineyard channel');
  if (!newweekChannel)  console.error('❌ Cannot find new week channel');

  // ── INFORMAL: every hour at :25 UK ───────────────────────────────────────
  if (informalChannel) {
    const scheduleInformal = () => {
      const uk = getUKTime();
      const secondsNow    = uk.hour * 3600 + uk.minute * 60 + uk.second;
      const secondsTarget = uk.hour * 3600 + 25 * 60; // this hour at :25
      let diffMs = (secondsTarget - secondsNow) * 1000;
      if (diffMs <= 0) diffMs += 3600 * 1000; // next hour if :25 already passed

      console.log(`⏰ Next informal roster in ${Math.round(diffMs/1000/60)} min`);
      setTimeout(async () => {
        try {
          const mainRoster = [];
          const msg = await informalChannel.send(buildInformalEmbed(mainRoster, new Date()));
          rosters.set(msg.id, { type: 'informal', mainRoster, closed: false, channelId: informalChannel.id, createdAt: new Date() });
          console.log(`📋 Informal roster posted`);
        } catch (e) { console.error('Failed to post informal roster:', e.message); }
        scheduleInformal();
      }, diffMs);
    };
    scheduleInformal();
  }

  // ── BIZWAR: 18:30 UK → closes 19:15 | 00:30 UK → closes 01:20 ───────────
  if (bizwarChannel) {
    scheduleDaily(18, 30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',    'bizwar',   19, 15));
    scheduleDaily(0,  30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',    'bizwar',   1,  20));
  }

  // ── RP-TICKET: 09:55 → 10:45 | 15:55 → 16:45 | 21:55 → 22:45 UK ────────
  if (rpticketChannel) {
    scheduleDaily(9,  55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster', 'rpticket', 10, 45));
    scheduleDaily(15, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster', 'rpticket', 16, 45));
    scheduleDaily(21, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster', 'rpticket', 22, 45));
  }

  // ── RATINGS:    20:10 UK → closes 21:10 ──────────────────────────────────
  // ── THE FOUNDRY: 13:50 UK → closes 14:50 (same channel) ─────────────────
  if (ratingsChannel) {
    scheduleDaily(20, 10, () => postWarRoster(ratingsChannel, 'ratings', 'Ratings-Roster',    'ratings', 21, 10));
    scheduleDaily(13, 50, () => postWarRoster(ratingsChannel, 'foundry', 'The Foundry-Roster', 'foundry', 14, 50));
  }

  // ── VINEYARD: 19:40 UK → closes 20:40 ────────────────────────────────────
  if (vineyardChannel) {
    scheduleDaily(19, 40, () => postWarRoster(vineyardChannel, 'vineyard', 'Vineyard-Roster', 'vineyard', 20, 40));
  }

  // ── NEW WEEK: every Monday at 04:00 UK ───────────────────────────────────
  if (newweekChannel) {
    const scheduleNewWeek = () => {
      const uk = getUKTime();

      // Seconds since UK midnight right now
      const secondsNow = uk.hour * 3600 + uk.minute * 60 + uk.second;
      // Seconds since UK midnight for target (Monday 04:00)
      const targetSeconds = 4 * 3600;

      // Days until next Monday (0 = Sunday, 1 = Monday ... 6 = Saturday)
      let daysUntilMonday = (1 - uk.dayOfWeek + 7) % 7;
      // If today IS Monday but 04:00 hasn't passed yet, fire today
      // If today IS Monday and 04:00 already passed, fire next Monday (7 days)
      if (daysUntilMonday === 0 && secondsNow >= targetSeconds) daysUntilMonday = 7;

      const diffMs = (daysUntilMonday * 86400 + targetSeconds - secondsNow) * 1000;
      console.log(`⏰ [NEW WEEK] fires in ${Math.round(diffMs/1000/60/60)} hours`);

      setTimeout(async () => {
        try {
          await newweekChannel.send('-------------------------------------------- NEW WEEK --------------------------------------------');
          console.log('📅 New week message sent');
        } catch (e) { console.error('Failed to send new week message:', e.message); }
        scheduleNewWeek();
      }, diffMs);
    };
    scheduleNewWeek();
  }
});

client.login(TOKEN);
