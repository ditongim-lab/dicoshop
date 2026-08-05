const { SlashCommandBuilder, PermissionFlagsBits, ChannelType } = require('discord.js');
const db = require('../database/db');
const { requireAdmin } = require('../utils/permissions');
const emojis = require('../config/emojis');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('설정')
    .setDescription('봇 서버 설정 (관리자 전용)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName('티켓로그채널')
        .setDescription('티켓 종료 로그(트랜스크립트)를 전송할 채널을 설정합니다.')
        .addChannelOption((opt) =>
          opt.setName('채널').setDescription('로그 채널').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('티켓관리자역할')
        .setDescription('티켓 및 충전 요청을 처리할 관리자 역할을 설정합니다.')
        .addRoleOption((opt) => opt.setName('역할').setDescription('관리자 역할').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('티켓카테고리')
        .setDescription('티켓 채널이 생성될 카테고리를 설정합니다.')
        .addChannelOption((opt) =>
          opt.setName('카테고리').setDescription('카테고리').addChannelTypes(ChannelType.GuildCategory).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('충전계좌')
        .setDescription('포인트 충전용 계좌 정보를 등록합니다.')
        .addStringOption((opt) => opt.setName('계좌정보').setDescription('은행명 + 계좌번호 + 예금주 등').setRequired(true))
    )
    .addSubcommand((sub) =>
      sub
        .setName('로그채널')
        .setDescription('구매/충전/이벤트 지급 로그를 전송할 채널을 설정합니다.')
        .addChannelOption((opt) =>
          opt.setName('채널').setDescription('로그 채널').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) =>
      sub
        .setName('허니팟채널')
        .setDescription(
          '보호 채널을 설정합니다. 일반 멤버가 볼 수 없도록 채널 권한을 미리 잠가두세요 — 이 채널에 메시지가 오면 작성자가 자동으로 서버에서 차단됩니다.'
        )
        .addChannelOption((opt) =>
          opt.setName('채널').setDescription('허니팟(트랩) 채널').addChannelTypes(ChannelType.GuildText).setRequired(true)
        )
    )
    .addSubcommand((sub) => sub.setName('확인').setDescription('현재 서버 설정을 확인합니다.')),

  async execute(interaction) {
    if (await requireAdmin(interaction)) return;

    const sub = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;

    switch (sub) {
      case '티켓로그채널': {
        const channel = interaction.options.getChannel('채널');
        db.updateConfig(guildId, { ticket_log_channel: channel.id });
        return interaction.reply(`${emojis.success} 티켓 로그 채널이 ${channel} 로 설정되었습니다.`);
      }
      case '티켓관리자역할': {
        const role = interaction.options.getRole('역할');
        db.updateConfig(guildId, { ticket_admin_role: role.id });
        return interaction.reply(`${emojis.success} 티켓 관리자 역할이 ${role} 로 설정되었습니다.`);
      }
      case '티켓카테고리': {
        const category = interaction.options.getChannel('카테고리');
        db.updateConfig(guildId, { ticket_category: category.id });
        return interaction.reply(`${emojis.success} 티켓 카테고리가 **${category.name}** 로 설정되었습니다.`);
      }
      case '충전계좌': {
        const accountInfo = interaction.options.getString('계좌정보');
        db.updateConfig(guildId, { charge_account: accountInfo });
        return interaction.reply(`${emojis.success} 충전 계좌 정보가 등록되었습니다.\n> ${accountInfo}`);
      }
      case '로그채널': {
        const channel = interaction.options.getChannel('채널');
        db.updateConfig(guildId, { log_channel: channel.id });
        return interaction.reply(`${emojis.success} 로그 채널이 ${channel} 로 설정되었습니다.`);
      }
      case '허니팟채널': {
        const channel = interaction.options.getChannel('채널');
        db.updateConfig(guildId, { honeypot_channel: channel.id });
        return interaction.reply({
          content:
            `${emojis.success} 허니팟 채널이 ${channel} 로 설정되었습니다.\n` +
            `${emojis.warning} **중요:** 이 채널은 반드시 @everyone 의 열람 권한을 차단해두세요. ` +
            `일반 멤버가 실수로 접근/전송할 수 없어야 오탐(정상 유저 차단)을 막을 수 있습니다.`,
        });
      }
      case '확인': {
        const config = db.getConfig(guildId);
        return interaction.reply({
          content:
            `${emojis.info} **현재 서버 설정**\n` +
            `티켓 로그 채널: ${config.ticket_log_channel ? `<#${config.ticket_log_channel}>` : '미설정'}\n` +
            `티켓 관리자 역할: ${config.ticket_admin_role ? `<@&${config.ticket_admin_role}>` : '미설정'}\n` +
            `티켓 카테고리: ${config.ticket_category ? `<#${config.ticket_category}>` : '미설정'}\n` +
            `충전 계좌: ${config.charge_account || '미설정'}\n` +
            `로그 채널: ${config.log_channel ? `<#${config.log_channel}>` : '미설정'}\n` +
            `허니팟 채널: ${config.honeypot_channel ? `<#${config.honeypot_channel}>` : '미설정'}`,
          ephemeral: true,
        });
      }
    }
  },
};
