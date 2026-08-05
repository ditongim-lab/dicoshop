const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelType,
  PermissionsBitField,
  AttachmentBuilder,
} = require('discord.js');
const fs = require('fs');
const os = require('os');
const path = require('path');
const db = require('../database/db');
const emojis = require('../config/emojis');

function sanitizeChannelName(username) {
  return `ticket-${username}`
    .toLowerCase()
    .replace(/[^a-z0-9가-힣-]/g, '-')
    .slice(0, 90);
}

// ─────────────────────────────
// 티켓 생성
// ─────────────────────────────
async function createTicket(interaction) {
  const guild = interaction.guild;
  const config = db.getConfig(guild.id);

  const existing = db.getOpenTicketByUser(guild.id, interaction.user.id);
  if (existing) {
    return interaction.reply({
      content: `${emojis.warning} 이미 열려있는 티켓이 있습니다: <#${existing.channel_id}>`,
      ephemeral: true,
    });
  }

  const overwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionsBitField.Flags.ViewChannel] },
    {
      id: interaction.user.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
        PermissionsBitField.Flags.AttachFiles,
      ],
    },
    {
      id: guild.members.me.id,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ManageChannels,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    },
  ];

  if (config.ticket_admin_role) {
    overwrites.push({
      id: config.ticket_admin_role,
      allow: [
        PermissionsBitField.Flags.ViewChannel,
        PermissionsBitField.Flags.SendMessages,
        PermissionsBitField.Flags.ReadMessageHistory,
      ],
    });
  }

  const channelOptions = {
    name: sanitizeChannelName(interaction.user.username),
    type: ChannelType.GuildText,
    permissionOverwrites: overwrites,
    topic: `문의 티켓 | 요청자: ${interaction.user.id}`,
  };

  if (config.ticket_category) {
    channelOptions.parent = config.ticket_category;
  }

  const ticketChannel = await guild.channels.create(channelOptions);

  db.createTicketRecord(guild.id, ticketChannel.id, interaction.user.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.ticket} 문의 티켓`)
    .setColor(0x5865f2)
    .setDescription(
      `${interaction.user} 님, 문의 내용을 남겨주세요.\n담당자가 확인 후 답변드립니다.\n\n문의가 끝나면 아래 **닫기** 버튼을 눌러주세요.`
    )
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('ticket_close').setLabel('닫기').setEmoji(emojis.lock).setStyle(ButtonStyle.Danger)
  );

  const mention = config.ticket_admin_role ? `<@&${config.ticket_admin_role}> ` : '';

  await ticketChannel.send({
    content: `${mention}${interaction.user}`,
    embeds: [embed],
    components: [row],
  });

  await interaction.reply({
    content: `${emojis.success} 티켓이 생성되었습니다: ${ticketChannel}`,
    ephemeral: true,
  });
}

// ─────────────────────────────
// 티켓 종료 -> 트랜스크립트 저장 후 로그 채널 전송
// ─────────────────────────────
async function closeTicket(interaction) {
  const ticket = db.getTicketByChannel(interaction.channel.id);

  if (!ticket) {
    return interaction.reply({ content: `${emojis.error} 티켓 채널이 아닙니다.`, ephemeral: true });
  }

  await interaction.reply({ content: `${emojis.loading} 티켓을 종료하고 로그를 저장합니다...` });

  const messages = await fetchAllMessages(interaction.channel);
  const transcript = buildTranscriptText(messages, interaction.channel, ticket);

  const tmpDir = path.join(os.tmpdir(), 'ticket-transcripts');
  if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
  const filePath = path.join(tmpDir, `${interaction.channel.name}-${ticket.id}.txt`);
  fs.writeFileSync(filePath, transcript, 'utf-8');

  db.closeTicketRecord(interaction.channel.id);

  const config = db.getConfig(interaction.guild.id);
  if (config.ticket_log_channel) {
    const logChannel = await interaction.guild.channels.fetch(config.ticket_log_channel).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      const attachment = new AttachmentBuilder(filePath, { name: path.basename(filePath) });
      const embed = new EmbedBuilder()
        .setTitle(`${emojis.log} 티켓 종료 로그`)
        .setColor(0xed4245)
        .addFields(
          { name: '티켓 채널', value: `#${interaction.channel.name}`, inline: true },
          { name: '요청자', value: `<@${ticket.user_id}>`, inline: true },
          { name: '종료자', value: `${interaction.user}`, inline: true }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed], files: [attachment] });
    }
  }

  fs.unlink(filePath, () => {});

  setTimeout(() => {
    interaction.channel.delete().catch(() => null);
  }, 3000);
}

async function fetchAllMessages(channel) {
  let allMessages = [];
  let lastId;

  while (true) {
    const options = { limit: 100 };
    if (lastId) options.before = lastId;
    const batch = await channel.messages.fetch(options);
    if (batch.size === 0) break;
    allMessages = allMessages.concat(Array.from(batch.values()));
    lastId = batch.last().id;
    if (batch.size < 100) break;
  }

  return allMessages.reverse();
}

function buildTranscriptText(messages, channel, ticket) {
  const header =
    `티켓 채널: #${channel.name}\n` +
    `요청자 ID: ${ticket.user_id}\n` +
    `생성 시각: ${new Date(ticket.created_at).toLocaleString('ko-KR')}\n` +
    `종료 시각: ${new Date().toLocaleString('ko-KR')}\n` +
    `${'='.repeat(50)}\n\n`;

  const body = messages
    .map((m) => {
      const time = m.createdAt.toLocaleString('ko-KR');
      const content = m.content || '(첨부파일 또는 임베드)';
      const attachments = m.attachments.size > 0 ? `\n  첨부: ${m.attachments.map((a) => a.url).join(', ')}` : '';
      return `[${time}] ${m.author.tag}: ${content}${attachments}`;
    })
    .join('\n');

  return header + body;
}

module.exports = {
  createTicket,
  closeTicket,
};
