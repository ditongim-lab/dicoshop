const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { requireAdmin } = require('../utils/permissions');
const logs = require('../systems/logs');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('이벤트지급')
    .setDescription('이벤트 보상으로 유저에게 포인트를 지급합니다. (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption((opt) => opt.setName('유저').setDescription('지급 대상').setRequired(true))
    .addIntegerOption((opt) => opt.setName('포인트').setDescription('지급할 포인트').setRequired(true).setMinValue(1))
    .addStringOption((opt) => opt.setName('사유').setDescription('지급 사유').setRequired(false)),

  async execute(interaction) {
    if (await requireAdmin(interaction)) return;

    const targetUser = interaction.options.getUser('유저');
    const amount = interaction.options.getInteger('포인트');
    const reason = interaction.options.getString('사유') || '이벤트 보상';

    const newBalance = db.addPoints(interaction.guild.id, targetUser.id, amount);
    db.addEventLog(interaction.guild.id, targetUser.id, amount, reason, interaction.user.id);

    await interaction.reply(
      `${emojis.event} ${targetUser} 님에게 ${amount} ${emojis.point} 지급 완료! (사유: ${reason} · 잔여: ${newBalance})`
    );

    await logs.logEventGive(interaction.guild, targetUser, amount, reason, interaction.user);
  },
};
