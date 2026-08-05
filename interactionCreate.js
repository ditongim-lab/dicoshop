const shop = require('../systems/vending-machine');
const ticket = require('../systems/ticket');
const payment = require('../systems/payment');
const db = require('../database/db');
const { isTicketAdmin } = require('../utils/permissions');
const emojis = require('../config/emojis');

module.exports = {
  name: 'interactionCreate',
  async execute(interaction) {
    try {
      // ── 슬래시 명령어 ──
      if (interaction.isChatInputCommand()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command) return;
        await command.execute(interaction);
        return;
      }

      // ── 자동완성 ──
      if (interaction.isAutocomplete()) {
        const command = interaction.client.commands.get(interaction.commandName);
        if (!command || !command.autocomplete) return;
        await command.autocomplete(interaction);
        return;
      }

      // ── 버튼 ──
      if (interaction.isButton()) {
        const { customId } = interaction;

        if (customId === 'shop_buy') return shop.handleBuyButton(interaction);
        if (customId === 'shop_charge') return shop.handleChargeButton(interaction);

        if (customId === 'shop_inquiry') return ticket.createTicket(interaction);

        if (customId === 'ticket_close') {
          const isOwner = interaction.user.id === getTicketOwnerFallback(interaction);
          if (!isTicketAdmin(interaction) && !isOwner) {
            return interaction.reply({ content: `${emojis.error} 티켓 작성자 또는 티켓 관리자만 닫을 수 있습니다.`, ephemeral: true });
          }
          return ticket.closeTicket(interaction);
        }

        if (customId.startsWith('charge_approve_') || customId.startsWith('charge_reject_')) {
          if (!isTicketAdmin(interaction)) {
            return interaction.reply({ content: `${emojis.error} 권한이 없습니다.`, ephemeral: true });
          }
          return payment.handleChargeDecision(interaction);
        }
      }

      // ── 셀렉트 메뉴 ──
      if (interaction.isStringSelectMenu()) {
        if (interaction.customId === 'shop_product_select') {
          return shop.handleProductSelect(interaction);
        }
      }

      // ── 모달 제출 ──
      if (interaction.isModalSubmit()) {
        if (interaction.customId === 'shop_charge_modal') {
          return shop.handleChargeModalSubmit(interaction);
        }
      }
    } catch (err) {
      console.error('[interactionCreate] 처리 중 오류:', err);
      const errorPayload = { content: `${emojis.error} 처리 중 오류가 발생했습니다.`, ephemeral: true };
      if (interaction.deferred || interaction.replied) {
        await interaction.followUp(errorPayload).catch(() => null);
      } else if (interaction.isRepliable && interaction.isRepliable()) {
        await interaction.reply(errorPayload).catch(() => null);
      }
    }
  },
};

// 티켓 종료 버튼은 티켓 관리자 또는 티켓 작성자 본인만 가능하도록 허용하기 위한 헬퍼
function getTicketOwnerFallback(interaction) {
  const ticketRecord = db.getTicketByChannel(interaction.channel.id);
  return ticketRecord ? ticketRecord.user_id : null;
}
