const { SlashCommandBuilder, PermissionFlagsBits } = require('discord.js');
const db = require('../database/db');
const { requireAdmin } = require('../utils/permissions');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('제품등록')
    .setDescription('자판기에 새 제품을 등록합니다. (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption((opt) => opt.setName('이름').setDescription('제품 이름').setRequired(true))
    .addIntegerOption((opt) => opt.setName('가격').setDescription('제품 가격 (포인트)').setRequired(true).setMinValue(1))
    .addIntegerOption((opt) => opt.setName('재고').setDescription('재고 수량').setRequired(true).setMinValue(0))
    .addStringOption((opt) => opt.setName('설명').setDescription('제품 설명').setRequired(false))
    .addAttachmentOption((opt) => opt.setName('이미지').setDescription('제품 이미지').setRequired(false)),

  async execute(interaction) {
    if (await requireAdmin(interaction)) return;

    const name = interaction.options.getString('이름');
    const price = interaction.options.getInteger('가격');
    const stock = interaction.options.getInteger('재고');
    const description = interaction.options.getString('설명') || '';
    const image = interaction.options.getAttachment('이미지');

    const existing = db.getProductByName(interaction.guild.id, name);
    if (existing) {
      return interaction.reply({
        content: `${emojis.warning} 이미 같은 이름의 제품이 등록되어 있습니다. 먼저 \`/제품삭제\` 로 삭제해주세요.`,
        ephemeral: true,
      });
    }

    const id = db.addProduct(interaction.guild.id, {
      name,
      price,
      description,
      image: image ? image.url : null,
      stock,
    });

    await interaction.reply({
      content: `${emojis.success} 제품이 등록되었습니다. (ID: ${id})\n**${name}** — ${price} 포인트, 재고 ${stock}개`,
    });
  },
};
