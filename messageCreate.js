const db = require('../database/db');
const logs = require('../systems/logs');

module.exports = {
  name: 'messageCreate',
  async execute(message) {
    if (!message.guild || message.author.bot) return;

    const config = db.getConfig(message.guild.id);
    if (!config.honeypot_channel) return;
    if (message.channel.id !== config.honeypot_channel) return;

    // 서버 관리자는 테스트/관리 목적상 예외 처리
    if (message.member && message.member.permissions.has('Administrator')) return;

    try {
      // 증거 보존을 위해 밴 전에 로그를 먼저 남긴다
      await logs.logHoneypotBan(message.guild, message.author, message.channel);
      await message.delete().catch(() => null);
      await message.guild.members.ban(message.author.id, {
        reason: '허니팟(보호) 채널에 메시지 전송 감지 - 자동 차단',
      });
    } catch (err) {
      console.error('[honeypot] 자동 차단 실패:', err);
    }
  },
};
