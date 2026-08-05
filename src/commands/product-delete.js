const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { requireAdmin } = require('../utils/permissions');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('제품삭제')
    .setDescription('등록된 제품을 삭제합니다. (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) =>
      opt.setName('이름').setDescription('삭제할 제품 이름').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const products = db.getProducts(interaction.guild.id);
    const filtered = products.filter((p) => p.name.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered.map((p) => ({ name: p.name, value: p.name })));
  },

  async execute(interaction) {
    if (await requireAdmin(interaction)) return;

    const name = interaction.options.getString('이름');
    const deleted = db.deleteProduct(interaction.guild.id, name);

    if (!deleted) {
      return interaction.reply({ content: `${emojis.error} 해당 이름의 제품을 찾을 수 없습니다.`, ephemeral: true });
    }

    await interaction.reply({ content: `${emojis.success} **${name}** 제품이 삭제되었습니다.` });
  },
};
