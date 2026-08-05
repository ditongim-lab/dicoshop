const { SlashCommandBuilder } = require('discord.js');
const db = require('../database/db');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('포인트')
    .setDescription('본인 또는 다른 유저의 포인트를 확인합니다.')
    .addUserOption((opt) => opt.setName('유저').setDescription('확인할 유저 (생략 시 본인)').setRequired(false)),

  async execute(interaction) {
    const targetUser = interaction.options.getUser('유저') || interaction.user;
    const points = db.getPoints(interaction.guild.id, targetUser.id);

    await interaction.reply({
      content: `${emojis.point} ${targetUser} 님의 보유 포인트: **${points}**`,
      ephemeral: targetUser.id === interaction.user.id,
    });
  },
};
