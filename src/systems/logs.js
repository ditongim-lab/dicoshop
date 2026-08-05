const { EmbedBuilder } = require('discord.js');
const { getConfig } = require('../database/db');
const emojis = require('../config/emojis');

/**
 * 서버에 설정된 로그 채널로 임베드를 전송합니다.
 * 로그 채널이 설정되어 있지 않으면 조용히 무시합니다.
 */
async function sendLog(guild, embed) {
  try {
    const config = getConfig(guild.id);
    if (!config.log_channel) return;
    const channel = await guild.channels.fetch(config.log_channel).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    console.error('[logs] 로그 전송 실패:', err);
  }
}

function buildLogEmbed(title, description, color = 0x5865f2, fields = []) {
  return new EmbedBuilder()
    .setTitle(title)
    .setDescription(description)
    .setColor(color)
    .addFields(fields)
    .setTimestamp();
}

async function logPurchase(guild, user, product, remainingStock, remainingPoints) {
  const embed = buildLogEmbed(
    `${emojis.cart} 구매 완료`,
    `${user} 님이 상품을 구매했습니다.`,
    0x57f287,
    [
      { name: '상품', value: product.name, inline: true },
      { name: '가격', value: `${product.price} ${emojis.point}`, inline: true },
      { name: '남은 재고', value: `${remainingStock}`, inline: true },
      { name: '구매자 잔여 포인트', value: `${remainingPoints} ${emojis.point}`, inline: true },
    ]
  );
  await sendLog(guild, embed);
}

async function logCharge(guild, user, amount, status, adminUser = null) {
  const statusText =
    status === 'approved' ? `${emojis.success} 승인` : status === 'rejected' ? `${emojis.error} 거절` : `${emojis.loading} 요청`;
  const embed = buildLogEmbed(
    `${emojis.charge} 포인트 충전 ${statusText}`,
    `${user} 님의 충전 요청입니다.`,
    status === 'approved' ? 0x57f287 : status === 'rejected' ? 0xed4245 : 0xfee75c,
    [
      { name: '금액', value: `${amount} ${emojis.point}`, inline: true },
      ...(adminUser ? [{ name: '처리 관리자', value: `${adminUser}`, inline: true }] : []),
    ]
  );
  await sendLog(guild, embed);
}

async function logEventGive(guild, targetUser, amount, reason, adminUser) {
  const embed = buildLogEmbed(
    `${emojis.event} 이벤트 포인트 지급`,
    `${targetUser} 님에게 포인트가 지급되었습니다.`,
    0x5865f2,
    [
      { name: '지급량', value: `${amount} ${emojis.point}`, inline: true },
      { name: '사유', value: reason || '없음', inline: true },
      { name: '지급 관리자', value: `${adminUser}`, inline: true },
    ]
  );
  await sendLog(guild, embed);
}

async function logHoneypotBan(guild, user, channel) {
  const embed = buildLogEmbed(
    `${emojis.lock} 허니팟 채널 감지 - 자동 차단`,
    `${user} (${user.id}) 님이 보호 채널 <#${channel.id}> 에 메시지를 전송하여 자동으로 서버에서 차단되었습니다.`,
    0xed4245
  );
  await sendLog(guild, embed);
}

module.exports = {
  sendLog,
  buildLogEmbed,
  logPurchase,
  logCharge,
  logEventGive,
  logHoneypotBan,
};
