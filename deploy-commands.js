require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { REST, Routes } = require('discord.js');

const commands = [];
const commandsPath = path.join(__dirname, 'src', 'commands');
const commandFiles = fs.readdirSync(commandsPath).filter((f) => f.endsWith('.js'));

for (const file of commandFiles) {
  const command = require(path.join(commandsPath, file));
  if (command?.data) {
    commands.push(command.data.toJSON());
  }
}

const rest = new REST().setToken(process.env.DISCORD_TOKEN);

(async () => {
  try {
    console.log(`🔄 슬래시 명령어 ${commands.length}개를 등록하는 중...`);

    let route;
    if (process.env.GUILD_ID) {
      route = Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID);
      console.log('   (테스트 서버 전용 등록 - 즉시 반영)');
    } else {
      route = Routes.applicationCommands(process.env.CLIENT_ID);
      console.log('   (글로벌 등록 - 최대 1시간 소요될 수 있음)');
    }

    const data = await rest.put(route, { body: commands });
    console.log(`✅ 슬래시 명령어 ${data.length}개 등록 완료!`);
  } catch (error) {
    console.error('❌ 명령어 등록 실패:', error);
  }
})();
