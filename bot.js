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
const NEWWEEK_CHANNEL_ID2 = '1473237583340376085';
const EVENTS_CHANNEL_ID   = '1473230268272869489';

// ─── Roster storage ────────────────────────────────────────────────────────────
const rosters = new Map();

// ─── Helpers ───────────────────────────────────────────────────────────────────
function formatDate(date) {
  return date.toLocaleDateString('en-GB', { timeZone: 'Europe/London', day: '2-digit', month: 'short', year: 'numeric' });
}
function formatTime(date) {
  return date.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
}

function getUKTime() {
  const now = new Date();
  const ukStr = now.toLocaleString('en-US', {
    timeZone: 'Europe/London', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });
  const [datePart, timePart] = ukStr.split(', ');
  const [month, day, year]   = datePart.split('/').map(Number);
  let   [hour, minute, second] = timePart.split(':').map(Number);
  if (hour === 24) hour = 0;
  return { now, year, month, day, hour, minute, second, dayOfWeek: new Date(year, month - 1, day).getDay() };
}

// ══════════════════════════════════════════════════════════════════════════════
//  INFORMAL ROSTER  (10 slots, no subs, no auto-close)
// ══════════════════════════════════════════════════════════════════════════════
function buildInformalEmbed(mainRoster, createdAt, closeAt = null, closed = false) {
  const lines = [];
  for (let i = 1; i <= 10; i++) {
    const user = mainRoster[i - 1];
    lines.push(`**${i}.** ${user ? `<@${user.id}> | ${user.username}` : ''}`);
  }
  const status = closed ? '🔴 CLOSED' : '🟢 Open';
  const color  = closed ? 0xED4245 : 0x57F287;
  const closeStr = closeAt ? `\n**Auto closes:** ${formatTime(closeAt)} UK` : '';

  const embed = new EmbedBuilder()
    .setTitle(closed ? '🔒 Informal Roster (CLOSED)' : '✅ Informal Roster (First 10 Only)')
    .setDescription(
      `**Status:** ${status}\n` +
      `**Created:** ${formatDate(createdAt)} • ${formatTime(createdAt)} UK` +
      closeStr + `\n\n` +
      `**Main Roster (1–10)**\n${lines.join('\n')}`
    )
    .setColor(color);

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('informal_join').setLabel('✅ Join').setStyle(ButtonStyle.Success).setDisabled(closed),
    new ButtonBuilder().setCustomId('informal_leave').setLabel('❌ Leave').setStyle(ButtonStyle.Danger).setDisabled(closed)
  );
  return { embeds: [embed], components: [row] };
}

// ══════════════════════════════════════════════════════════════════════════════
//  SHARED: 25 main + 10 subs roster embed
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
    const msg = await message.channel.send(buildInformalEmbed(mainRoster, new Date(), null));
    rosters.set(msg.id, { type: 'informal', mainRoster, closeAt: null, closed: false, channelId: message.channel.id, createdAt: new Date() });
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

  // ── !timers — shows when every event will next fire ──
  if (message.content === '!timers') {
    const uk = getUKTime();
    const secondsNow = uk.hour * 3600 + uk.minute * 60 + uk.second;

    function nextFire(hour, minute) {
      let diff = (hour * 3600 + minute * 60) - secondsNow;
      if (diff <= 0) diff += 86400;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const fireDate = new Date(Date.now() + diff * 1000);
      const timeStr = fireDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
      return `in **${h}h ${m}m** (at ${timeStr} UK)`;
    }

    function nextInformal() {
      let diff = (uk.hour * 3600 + 25 * 60) - secondsNow;
      if (diff <= 0) diff += 3600;
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const fireDate = new Date(Date.now() + diff * 1000);
      const timeStr = fireDate.toLocaleTimeString('en-GB', { timeZone: 'Europe/London', hour: '2-digit', minute: '2-digit' });
      return `in **${h}h ${m}m** (at ${timeStr} UK)`;
    }

    function nextMonday4am() {
      let daysUntilMonday = (1 - uk.dayOfWeek + 7) % 7;
      if (daysUntilMonday === 0 && secondsNow >= 4 * 3600) daysUntilMonday = 7;
      const diff = daysUntilMonday * 86400 + 4 * 3600 - secondsNow;
      const totalHours = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const days = Math.floor(totalHours / 24);
      const h = totalHours % 24;
      return `in **${days}d ${h}h ${m}m**`;
    }

    const reply = [
      `🕐 **Current UK time:** ${String(uk.hour).padStart(2, '0')}:${String(uk.minute).padStart(2, '0')}`,
      ``,
      `📋 **Informal Roster** — next post ${nextInformal()} *(closes at :45)*`,
      ``,
      `⚔️ **BizWar Roster**`,
      `　• 18:30 post → ${nextFire(18, 30)} *(closes 19:15)*`,
      `　• 00:30 post → ${nextFire(0, 30)} *(closes 01:20)*`,
      ``,
      `🎟️ **RP-Ticket Roster**`,
      `　• 09:55 post → ${nextFire(9, 55)} *(closes 10:45)*`,
      `　• 15:55 post → ${nextFire(15, 55)} *(closes 16:45)*`,
      `　• 21:55 post → ${nextFire(21, 55)} *(closes 22:45)*`,
      ``,
      `⭐ **Ratings-Roster** → ${nextFire(20, 10)} *(closes 21:10)*`,
      ``,
      `🏭 **The Foundry-Roster** → ${nextFire(13, 50)} *(closes 14:50)*`,
      ``,
      `🌿 **Vineyard-Roster** → ${nextFire(19, 40)} *(closes 20:40)*`,
      ``,
      `📅 **NEW WEEK message** → ${nextMonday4am()} *(every Monday 04:00 UK)*`,
    ].join('\n');

    await message.reply({ content: reply });
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

  if (interaction.customId === 'informal_join') {
    if (data.mainRoster.find(u => u.id === userId))
      return interaction.reply({ content: '⚠️ You\'re already on the roster!', ephemeral: true });
    if (data.mainRoster.length >= 10)
      return interaction.reply({ content: '❌ The roster is full (10/10)!', ephemeral: true });
    data.mainRoster.push({ id: userId, username });
    await interaction.message.edit(buildInformalEmbed(data.mainRoster, data.createdAt, data.closeAt, data.closed));
    return interaction.reply({ content: '✅ You\'ve been added to the roster!', ephemeral: true });
  }
  if (interaction.customId === 'informal_leave') {
    const index = data.mainRoster.findIndex(u => u.id === userId);
    if (index === -1)
      return interaction.reply({ content: '⚠️ You\'re not on the roster.', ephemeral: true });
    data.mainRoster.splice(index, 1);
    await interaction.message.edit(buildInformalEmbed(data.mainRoster, data.createdAt, data.closeAt, data.closed));
    return interaction.reply({ content: '✅ You\'ve been removed from the roster.', ephemeral: true });
  }

  if (interaction.customId === 'bizwar_join')   return handleWarJoin(interaction,  data, 'BizWar Roster',      'bizwar');
  if (interaction.customId === 'bizwar_leave')  return handleWarLeave(interaction, data, 'BizWar Roster',      'bizwar');
  if (interaction.customId === 'rpticket_join') return handleWarJoin(interaction,  data, 'RP-Ticket Roster',   'rpticket');
  if (interaction.customId === 'rpticket_leave')return handleWarLeave(interaction, data, 'RP-Ticket Roster',   'rpticket');
  if (interaction.customId === 'ratings_join')  return handleWarJoin(interaction,  data, 'Ratings-Roster',     'ratings');
  if (interaction.customId === 'ratings_leave') return handleWarLeave(interaction, data, 'Ratings-Roster',     'ratings');
  if (interaction.customId === 'foundry_join')  return handleWarJoin(interaction,  data, 'The Foundry-Roster', 'foundry');
  if (interaction.customId === 'foundry_leave') return handleWarLeave(interaction, data, 'The Foundry-Roster', 'foundry');
  if (interaction.customId === 'vineyard_join') return handleWarJoin(interaction,  data, 'Vineyard-Roster',    'vineyard');
  if (interaction.customId === 'vineyard_leave')return handleWarLeave(interaction, data, 'Vineyard-Roster',    'vineyard');
});

// ══════════════════════════════════════════════════════════════════════════════
//  CLOSE ROSTER
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
      await msg.edit(buildInformalEmbed(data.mainRoster, data.createdAt, data.closeAt, true));
    } else {
      await msg.edit(buildWarEmbed(nameMap[data.type], data.type, data.mainRoster, data.subsRoster, data.createdAt, data.closeAt, true));
    }
    console.log(`🔒 Closed roster ${msgId} (${data.type})`);
  } catch (e) {
    console.error(`Failed to close roster ${msgId}:`, e.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════════
//  SCHEDULE HELPER — fires at HH:MM UK, repeats daily
// ══════════════════════════════════════════════════════════════════════════════
function scheduleDaily(hour, minute, callback) {
  const fire = async () => {
    const uk = getUKTime();
    const secondsNow    = uk.hour * 3600 + uk.minute * 60 + uk.second;
    const targetSeconds = hour * 3600 + minute * 60;
    let diffSeconds = targetSeconds - secondsNow;
    if (diffSeconds <= 0) diffSeconds += 86400;

    console.log(`⏰ [${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')} UK] fires in ${Math.round(diffSeconds/60)} min`);

    setTimeout(async () => {
      try { await callback(); } catch (e) { console.error('Scheduler error:', e.message); }
      fire();
    }, diffSeconds * 1000);
  };
  fire();
}

// ══════════════════════════════════════════════════════════════════════════════
//  POST HELPER — posts a war roster and schedules its auto-close
// ══════════════════════════════════════════════════════════════════════════════
async function postWarRoster(channel, type, rosterName, customIdPrefix, closeHour, closeMinute) {
  const mainRoster = [], subsRoster = [];
  const createdAt = new Date();

  const uk = getUKTime();
  const secondsNow  = uk.hour * 3600 + uk.minute * 60 + uk.second;
  const closeSeconds = closeHour * 3600 + closeMinute * 60;
  let diffToCloseMs = (closeSeconds - secondsNow) * 1000;
  if (diffToCloseMs <= 0) diffToCloseMs += 86400 * 1000;

  const closeAt = new Date(createdAt.getTime() + diffToCloseMs);

  const msg   = await channel.send(buildWarEmbed(rosterName, customIdPrefix, mainRoster, subsRoster, createdAt, closeAt));
  const msgId = msg.id;
  rosters.set(msgId, { type, mainRoster, subsRoster, closed: false, channelId: channel.id, createdAt, closeAt });
  console.log(`📋 ${rosterName} posted — closes in ${Math.round(diffToCloseMs/60000)} min`);

  setTimeout(() => closeRoster(msgId), diffToCloseMs);
}

// ══════════════════════════════════════════════════════════════════════════════
//  BOT READY
// ══════════════════════════════════════════════════════════════════════════════
client.once('clientReady', async () => {
  console.log(`✅ Bot is online as ${client.user.tag}`);

  const informalChannel = await client.channels.fetch(INFORMAL_CHANNEL_ID).catch(() => null);
  const bizwarChannel   = await client.channels.fetch(BIZWAR_CHANNEL_ID).catch(() => null);
  const rpticketChannel = await client.channels.fetch(RPTICKET_CHANNEL_ID).catch(() => null);
  const ratingsChannel  = await client.channels.fetch(RATINGS_CHANNEL_ID).catch(() => null);
  const vineyardChannel = await client.channels.fetch(VINEYARD_CHANNEL_ID).catch(() => null);
  const newweekChannel  = await client.channels.fetch(NEWWEEK_CHANNEL_ID).catch(() => null);
  const newweekChannel2 = await client.channels.fetch(NEWWEEK_CHANNEL_ID2).catch(() => null);
  const eventsChannel   = await client.channels.fetch(EVENTS_CHANNEL_ID).catch(() => null);

  if (!informalChannel) console.error('❌ Cannot find informal channel');
  if (!bizwarChannel)   console.error('❌ Cannot find bizwar channel');
  if (!rpticketChannel) console.error('❌ Cannot find rp-ticket channel');
  if (!ratingsChannel)  console.error('❌ Cannot find ratings/foundry channel');
  if (!vineyardChannel) console.error('❌ Cannot find vineyard channel');
  if (!newweekChannel)  console.error('❌ Cannot find new week channel');
  if (!newweekChannel2) console.error('❌ Cannot find new week channel 2');
  if (!eventsChannel)   console.error('❌ Cannot find events channel');

  // ── INFORMAL: posts at :25, closes at :45 every hour ────────────────────
  if (informalChannel) {
    const scheduleInformal = () => {
      const uk = getUKTime();
      const secondsNow = uk.hour * 3600 + uk.minute * 60 + uk.second;
      let diff = (uk.hour * 3600 + 25 * 60) - secondsNow;
      if (diff <= 0) diff += 3600;
      console.log(`⏰ Next informal roster in ${Math.round(diff/60)} min`);
      setTimeout(async () => {
        try {
          const mainRoster = [];
          const createdAt = new Date();
          
          // Calculate closeAt: :45 of this hour (20 minutes after :25)
          const ukNow = getUKTime();
          const closeSecondsNow = ukNow.hour * 3600 + ukNow.minute * 60 + ukNow.second;
          const closeSecondsTarget = ukNow.hour * 3600 + 45 * 60;
          const diffToClose = (closeSecondsTarget - closeSecondsNow) * 1000;
          const closeAt = new Date(Date.now() + diffToClose);

          const msg = await informalChannel.send(buildInformalEmbed(mainRoster, createdAt, closeAt));
          rosters.set(msg.id, { type: 'informal', mainRoster, closeAt, closed: false, channelId: informalChannel.id, createdAt });
          console.log(`📋 Informal roster posted — closes in ${Math.round(diffToClose/60000)} min`);

          // Schedule auto-close at :45
          setTimeout(() => closeRoster(msg.id), diffToClose);
        } catch (e) { console.error('Failed to post informal:', e.message); }
        scheduleInformal();
      }, diff * 1000);
    };
    scheduleInformal();
  }

  // ── BIZWAR: 18:30 → 19:15 | 00:30 → 01:20 UK ────────────────────────────
  if (bizwarChannel) {
    scheduleDaily(18, 30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',     'bizwar',   19, 15));
    scheduleDaily(0,  30, () => postWarRoster(bizwarChannel,  'bizwar',   'BizWar Roster',     'bizwar',   1,  20));
  }

  // ── RP-TICKET: 09:55 → 10:45 | 15:55 → 16:45 | 21:55 → 22:45 UK ────────
  if (rpticketChannel) {
    scheduleDaily(9,  55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 10, 45));
    scheduleDaily(15, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 16, 45));
    scheduleDaily(21, 55, () => postWarRoster(rpticketChannel, 'rpticket', 'RP-Ticket Roster',  'rpticket', 22, 45));
  }

  // ── RATINGS: 20:10 → 21:10 | FOUNDRY: 13:50 → 14:50 UK ─────────────────
  if (ratingsChannel) {
    scheduleDaily(20, 10, () => postWarRoster(ratingsChannel, 'ratings', 'Ratings-Roster',     'ratings', 21, 10));
    scheduleDaily(13, 50, () => postWarRoster(ratingsChannel, 'foundry', 'The Foundry-Roster', 'foundry', 14, 50));
  }

  // ── VINEYARD: 19:40 → 20:40 UK ───────────────────────────────────────────
  if (vineyardChannel) {
    scheduleDaily(19, 40, () => postWarRoster(vineyardChannel, 'vineyard', 'Vineyard-Roster', 'vineyard', 20, 40));
  }

  // ── EVENT ANNOUNCEMENTS ──────────────────────────────────────────────────
  if (eventsChannel) {
    async function announceEvent(eventName) {
      try {
        await eventsChannel.send(`@everyone COME IN GAME WE HAVE A VERY IMPORTANT EVENT ${eventName}`);
        console.log(`📢 Event announced: ${eventName}`);
      } catch (e) { console.error(`Failed to announce ${eventName}:`, e.message); }
    }

    // Helper for day-specific events (0=Sunday, 1=Monday, ..., 6=Saturday)
    function scheduleDaySpecific(hour, minute, eventName, allowedDays) {
      scheduleDaily(hour, minute, async () => {
        const uk = getUKTime();
        if (allowedDays.includes(uk.dayOfWeek)) {
          await announceEvent(eventName);
        }
      });
    }

    // Daily events
    scheduleDaily(14,  54, () => announceEvent('Harbor'));
    scheduleDaily(7,  10, () => announceEvent('Harbor'));
    scheduleDaily(10,  0, () => announceEvent('Drug Lab'));
    scheduleDaily(10, 10, () => announceEvent('Harbor'));
    scheduleDaily(13, 10, () => announceEvent('Harbor'));
    scheduleDaily(16, 10, () => announceEvent('Harbor'));
    scheduleDaily(16, 30, () => announceEvent('Factory of RP tickets'));
    scheduleDaily(17, 15, () => announceEvent('Mall (17:15 registration, 17:20 defense side goes in, 17:25 attack side goes in)'));
    scheduleDaily(19,  5, () => announceEvent('Business War - PRIORITY'));
    scheduleDaily(19, 10, () => announceEvent('Harbor'));
    scheduleDaily(20, 30, () => announceEvent('Leftover Components - PRIORITY'));
    scheduleDaily(20, 50, () => announceEvent('Rating Battle - PRIORITY'));
    scheduleDaily(21, 30, () => announceEvent('Aircraft Carrier - PRIORITY'));
    scheduleDaily(22, 10, () => announceEvent('Harbor'));
    scheduleDaily(22, 30, () => announceEvent('Factory of RP tickets'));
    scheduleDaily(1,   5, () => announceEvent('Business War - PRIORITY'));
    scheduleDaily(1,  10, () => announceEvent('Harbor'));
    scheduleDaily(2,  20, () => announceEvent('Hotel Takeover'));
    scheduleDaily(4,  10, () => announceEvent('Harbor'));

    // Day-specific events
    scheduleDaySpecific(20, 20, 'Attacking Prison - PRIORITY', [5]); // Friday only
    scheduleDaySpecific(20, 20, 'King Of Cayo Perico Island - PRIORITY', [0, 3]); // Sunday & Wednesday
    scheduleDaySpecific(21, 30, 'Bank Robbery - PRIORITY', [1, 3, 6]); // Monday, Wednesday, Saturday
  }

  // ── NEW WEEK: every Monday at 04:00 UK ───────────────────────────────────
  if (newweekChannel) {
    const scheduleNewWeek = () => {
      const uk = getUKTime();
      const secondsNow = uk.hour * 3600 + uk.minute * 60 + uk.second;
      let daysUntilMonday = (1 - uk.dayOfWeek + 7) % 7;
      if (daysUntilMonday === 0 && secondsNow >= 4 * 3600) daysUntilMonday = 7;
      const diffSeconds = daysUntilMonday * 86400 + 4 * 3600 - secondsNow;
      console.log(`⏰ [NEW WEEK] fires in ${Math.round(diffSeconds/3600)} hours`);
      setTimeout(async () => {
        try {
          await newweekChannel.send('------------------------------------------------------------ NEW WEEK ------------------------------------------------------------');
          if (newweekChannel2) await newweekChannel2.send('------------------------------------------------------------ NEW WEEK ------------------------------------------------------------');
          console.log('📅 New week message sent');
        } catch (e) { console.error('Failed to send new week:', e.message); }
        scheduleNewWeek();
      }, diffSeconds * 1000);
    };
    scheduleNewWeek();
  }
});

client.login(TOKEN);
