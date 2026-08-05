const {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
} = require('discord.js');
const db = require('../database/db');
const emojis = require('../config/emojis');
const logs = require('./logs');
const payment = require('./payment');

// ─────────────────────────────
// 자판기 패널
// ─────────────────────────────
function buildShopEmbed(guild) {
  const products = db.getProducts(guild.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.vending} 자판기`)
    .setColor(0x5865f2)
    .setFooter({ text: guild.name, iconURL: guild.iconURL() || undefined })
    .setTimestamp();

  if (products.length === 0) {
    embed.setDescription('현재 등록된 제품이 없습니다. 관리자에게 문의해주세요.');
  } else {
    embed.setDescription(
      products
        .map((p) => {
          const stockText = p.stock > 0 ? `재고 ${p.stock}개` : '**품절**';
          return `${emojis.stock} **${p.name}** — ${p.price} ${emojis.point}\n> ${stockText}`;
        })
        .join('\n\n')
    );
  }

  return embed;
}

function buildShopButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('shop_buy').setLabel('구매하기').setEmoji(emojis.cart).setStyle(ButtonStyle.Success),
    new ButtonBuilder().setCustomId('shop_charge').setLabel('충전하기').setEmoji(emojis.charge).setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('shop_inquiry').setLabel('문의하기').setEmoji(emojis.ticket).setStyle(ButtonStyle.Secondary)
  );
}

async function sendShopPanel(interactionOrChannel) {
  const embed = buildShopEmbed(interactionOrChannel.guild);
  const row = buildShopButtons();
  const payload = { embeds: [embed], components: [row] };

  if (interactionOrChannel.isRepliable && interactionOrChannel.isRepliable()) {
    return interactionOrChannel.reply(payload);
  }
  return interactionOrChannel.send(payload);
}

// ─────────────────────────────
// 구매하기 버튼 -> 상품 선택 메뉴
// ─────────────────────────────
async function handleBuyButton(interaction) {
  const products = db.getProducts(interaction.guild.id).filter((p) => p.stock > 0);

  if (products.length === 0) {
    return interaction.reply({
      content: `${emojis.error} 현재 구매 가능한 제품이 없습니다.`,
      ephemeral: true,
    });
  }

  const menu = new StringSelectMenuBuilder()
    .setCustomId('shop_product_select')
    .setPlaceholder('구매할 제품을 선택하세요')
    .addOptions(
      products.slice(0, 25).map((p) => ({
        label: `${p.name} (${p.price} 포인트)`,
        description: `재고 ${p.stock}개${p.description ? ' · ' + p.description.slice(0, 50) : ''}`,
        value: String(p.id),
      }))
    );

  const row = new ActionRowBuilder().addComponents(menu);

  return interaction.reply({
    content: `${emojis.cart} 구매할 제품을 선택해주세요.`,
    components: [row],
    ephemeral: true,
  });
}

// ─────────────────────────────
// 상품 선택 -> 구매 처리
// ─────────────────────────────
async function handleProductSelect(interaction) {
  const productId = Number(interaction.values[0]);
  const product = db.getProductById(productId);

  if (!product) {
    return interaction.update({ content: `${emojis.error} 존재하지 않는 제품입니다.`, components: [] });
  }

  if (product.stock <= 0) {
    return interaction.update({ content: `${emojis.error} **${product.name}** 은(는) 품절되었습니다.`, components: [] });
  }

  const userPoints = db.getPoints(interaction.guild.id, interaction.user.id);

  if (userPoints < product.price) {
    return interaction.update({
      content: `${emojis.error} 포인트가 부족합니다. (보유: ${userPoints} / 필요: ${product.price})`,
      components: [],
    });
  }

  db.subtractPoints(interaction.guild.id, interaction.user.id, product.price);
  db.decrementStock(product.id, 1);
  db.addPurchaseLog(interaction.guild.id, interaction.user.id, product.id, product.name, product.price);

  const remaining = db.getPoints(interaction.guild.id, interaction.user.id);
  const updatedProduct = db.getProductById(product.id);

  const embed = new EmbedBuilder()
    .setTitle(`${emojis.success} 구매 완료`)
    .setColor(0x57f287)
    .setDescription(`**${product.name}** 구매가 완료되었습니다!`)
    .addFields(
      { name: '결제 금액', value: `${product.price} ${emojis.point}`, inline: true },
      { name: '남은 포인트', value: `${remaining} ${emojis.point}`, inline: true }
    );

  if (product.image) embed.setThumbnail(product.image);

  await interaction.update({ content: '', embeds: [embed], components: [] });
  await logs.logPurchase(interaction.guild, interaction.user, product, updatedProduct.stock, remaining);
}

// ─────────────────────────────
// 충전하기 버튼 -> 모달
// ─────────────────────────────
async function handleChargeButton(interaction) {
  const config = db.getConfig(interaction.guild.id);

  if (!config.charge_account) {
    return interaction.reply({
      content: `${emojis.warning} 아직 관리자가 충전 계좌를 등록하지 않았습니다. 잠시 후 다시 시도해주세요.`,
      ephemeral: true,
    });
  }

  const modal = new ModalBuilder().setCustomId('shop_charge_modal').setTitle('포인트 충전 요청');

  const amountInput = new TextInputBuilder()
    .setCustomId('charge_amount')
    .setLabel('입금하신(하실) 금액을 입력해주세요')
    .setPlaceholder('예: 10000')
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(amountInput));

  await interaction.showModal(modal);
}

async function handleChargeModalSubmit(interaction) {
  const raw = interaction.fields.getTextInputValue('charge_amount').replace(/[,\s]/g, '');
  const amount = Number(raw);

  if (!Number.isInteger(amount) || amount <= 0) {
    return interaction.reply({ content: `${emojis.error} 올바른 숫자를 입력해주세요.`, ephemeral: true });
  }

  const config = db.getConfig(interaction.guild.id);
  const requestId = await payment.createAndPostChargeRequest(interaction, amount, config);

  await interaction.reply({
    content: `${emojis.loading} 충전 요청이 접수되었습니다. (요청 번호 #${requestId})\n관리자가 입금을 확인한 뒤 포인트가 지급됩니다.`,
    ephemeral: true,
  });
}

// ─────────────────────────────
// 문의하기 버튼 -> 티켓 시스템으로 위임 (index.js/interactionCreate.js 에서 처리)
// ─────────────────────────────

module.exports = {
  buildShopEmbed,
  buildShopButtons,
  sendShopPanel,
  handleBuyButton,
  handleProductSelect,
  handleChargeButton,
  handleChargeModalSubmit,
};
