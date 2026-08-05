const { PermissionsBitField } = require('discord.js');
const db = require('../database/db');
const emojis = require('../config/emojis');

/** 서버 관리자(Administrator 권한) 여부 */
function isAdmin(interaction) {
  return interaction.member.permissions.has(PermissionsBitField.Flags.Administrator);
}

/** 관리자가 아니면 에러 응답 후 true(차단됨) 반환, 관리자면 false 반환 */
async function requireAdmin(interaction) {
  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: `${emojis.error} 이 명령어는 관리자만 사용할 수 있습니다.`,
      ephemeral: true,
    });
    return true;
  }
  return false;
}

/** 티켓 관리자 역할 또는 서버 관리자 여부 */
function isTicketAdmin(interaction) {
  if (isAdmin(interaction)) return true;
  const config = db.getConfig(interaction.guild.id);
  if (!config.ticket_admin_role) return false;
  return interaction.member.roles.cache.has(config.ticket_admin_role);
}

module.exports = { isAdmin, requireAdmin, isTicketAdmin };
