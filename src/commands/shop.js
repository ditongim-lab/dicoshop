const { SlashCommandBuilder } = require('discord.js');
const shop = require('../systems/vending-machine');

module.exports = {
  data: new SlashCommandBuilder().setName('shop').setDescription('자판기(포인트 상점) 패널을 표시합니다.'),

  async execute(interaction) {
    await shop.sendShopPanel(interaction);
  },
};
