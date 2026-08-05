module.exports = {
  name: 'ready',
  once: true,
  execute(client) {
    console.log(`✅ 로그인 완료: ${client.user.tag}`);
    client.user.setActivity('/shop | 자판기 운영중', { type: 3 }); // 3 = Watching
  },
};
