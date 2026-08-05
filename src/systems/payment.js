const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const db = require('../database/db');
const emojis = require('../config/emojis');
const logs = require('./logs');

/**
 * 충전 요청을 DB에 기록하고, 로그 채널(없으면 현재 채널)에
 * 관리자가 승인/거절할 수 있는 임베드+버튼을 전송합니다.
 */
async function createAndPostChargeRequest(interaction, amount, config) {
  const requestId = db.createChargeRequest(interaction.guild.id, interaction.user.id, amount);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.charge} 포인트 충전 요청 #${requestId}`)
    .setColor(0xfee75c)
    .setDescription(
      `${interaction.user} 님이 포인트 충전을 요청했습니다.\n\n` +
        `**입금 계좌:** ${config.charge_account || '등록된 계좌 없음'}\n` +
        `**요청 금액:** ${amount} ${emojis.point}`
    )
    .setFooter({ text: `요청자 ID: ${interaction.user.id}` })
    .setTimestamp();

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`charge_approve_${requestId}`).setLabel('승인').setEmoji(emojis.success).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId(`charge_reject_${requestId}`).setLabel('거절').setEmoji(emojis.error).setStyle(ButtonStyle.Danger)
  );

  let targetChannel = null;
  if (config.log_channel) {
    targetChannel = await interaction.guild.channels.fetch(config.log_channel).catch(() => null);
  }
  if (!targetChannel || !targetChannel.isTextBased()) {
    targetChannel = interaction.channel;
  }

  let mentionContent = '';
  if (config.ticket_admin_role) {
    mentionContent = `<@&${config.ticket_admin_role}>`;
  }

  const sentMessage = await targetChannel.send({
    content: mentionContent || undefined,
    embeds: [embed],
    components: [row],
  });

  db.setChargeRequestMessage(requestId, sentMessage.id);
  await logs.logCharge(interaction.guild, interaction.user, amount, 'requested');

  return requestId;
}

/**
 * 승인/거절 버튼 처리. customId 형식: charge_approve_{id} / charge_reject_{id}
 */
async function handleChargeDecision(interaction) {
  const isApprove = interaction.customId.startsWith('charge_approve_');
  const requestId = Number(interaction.customId.split('_').pop());
  const request = db.getChargeRequest(requestId);

  if (!request) {
    return interaction.reply({ content: `${emojis.error} 존재하지 않는 요청입니다.`, ephemeral: true });
  }

  if (request.status !== 'pending') {
    return interaction.reply({
      content: `${emojis.warning} 이미 처리된 요청입니다. (현재 상태: ${request.status})`,
      ephemeral: true,
    });
  }

  const targetUser = await interaction.client.users.fetch(request.user_id).catch(() => null);

  if (isApprove) {
    db.addPoints(request.guild_id, request.user_id, request.amount);
    db.updateChargeRequestStatus(requestId, 'approved');

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0x57f287)
      .setTitle(`${emojis.success} 충전 승인 완료 #${requestId}`);

    await interaction.update({ embeds: [embed], components: [] });
    await logs.logCharge(interaction.guild, targetUser || { toString: () => `<@${request.user_id}>` }, request.amount, 'approved', interaction.user);

    if (targetUser) {
      await targetUser
        .send(`${emojis.success} ${interaction.guild.name} 서버에서 ${request.amount} 포인트 충전이 승인되었습니다!`)
        .catch(() => null);
    }
  } else {
    db.updateChargeRequestStatus(requestId, 'rejected');

    const embed = EmbedBuilder.from(interaction.message.embeds[0])
      .setColor(0xed4245)
      .setTitle(`${emojis.error} 충전 거절 #${requestId}`);

    await interaction.update({ embeds: [embed], components: [] });
    await logs.logCharge(interaction.guild, targetUser || { toString: () => `<@${request.user_id}>` }, request.amount, 'rejected', interaction.user);

    if (targetUser) {
      await targetUser
        .send(`${emojis.error} ${interaction.guild.name} 서버에서 충전 요청이 거절되었습니다. 관리자에게 문의해주세요.`)
        .catch(() => null);
    }
  }
}

module.exports = {
  createAndPostChargeRequest,
  handleChargeDecision,
};
