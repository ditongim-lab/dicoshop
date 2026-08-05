const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');
const db = require('../database/db');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('제품설명')
    .setDescription('제품 설명 Embed를 표시합니다.')
    .addStringOption((opt) =>
      opt.setName('이름').setDescription('제품 이름').setRequired(true).setAutocomplete(true)
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    const products = db.getProducts(interaction.guild.id);
    const filtered = products.filter((p) => p.name.toLowerCase().includes(focused)).slice(0, 25);
    await interaction.respond(filtered.map((p) => ({ name: p.name, value: p.name })));
  },

  async execute(interaction) {
    const name = interaction.options.getString('이름');
    const product = db.getProductByName(interaction.guild.id, name);

    if (!product) {
      return interaction.reply({ content: `${emojis.error} 해당 이름의 제품을 찾을 수 없습니다.`, ephemeral: true });
    }

    const embed = new EmbedBuilder()
      .setTitle(`${emojis.stock} ${product.name}`)
      .setColor(0x5865f2)
      .setDescription(product.description || '설명이 없습니다.')
      .addFields(
        { name: '가격', value: `${product.price} ${emojis.point}`, inline: true },
        { name: '재고', value: `${product.stock}개`, inline: true }
      )
      .setTimestamp();

    if (product.image) embed.setImage(product.image);

    await interaction.reply({ embeds: [embed] });
  },
};
