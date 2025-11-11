import { Client, Events, GatewayIntentBits, EmbedBuilder, REST, Routes } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import axios, { all } from 'axios';
import dotenv from 'dotenv';
import { time } from 'console';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Commandes
const commands = [
  {
    name: "rotation",
    description: "Show current and 3 next stages"
  },
];

const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);

try {
  console.log("Started refreshing application (/)commands.");

  await rest.put(Routes.applicationGuildCommands(process.env.CLIENT_ID, process.env.GUILD_ID), { body: commands });

  console.log("Successfully reloaded application (/)commands.");
} catch (error) {
  console.error(error);
}

// Créer un nouveau client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
  ]
});

// Configuration
const channelId = process.env.CHANNEL_ID;
const API_MAPS = "https://splatoon.oatmealdome.me/api/v1/one/resources/versus?language=EUen";
const API_CURRENT_MAPS = "https://splatoon.oatmealdome.me/api/v1/one/versus/pretendo/phases?count=1";
let lastMessageId = null;
let lastPhaseId = null;

// Variables pour le suivi
let lastSentHour = null;

// Quand le bot est prêt
client.once(Events.ClientReady, () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  // Rich presence du bot
  client.user.setPresence({
    activities: [
      {
        name: "Splatoon 1",
        type: 0
      }
    ],
    status: "online"
  });

  // Vérifier l'heure toutes les minutes
  setInterval(checkHour, 60 * 1000);

  // Vérifier immédiatement au démarrage
  // checkHour();

  // Vérifier les données toutes les heures
  checkData();

});

// Fonction pour vérifier l'heure et envoyer un message si c'est une heure paire
async function checkHour() {
  if (!channelId) {
    console.log("❌ ID de canal non défini");
    return;
  }

  const now = new Date();
  const currentHour = now.getHours();

  // Vérifier si l'heure est paire et si on n'a pas déjà envoyé un message pour cette heure
  if (currentHour % 2 === 0 && currentHour !== lastSentHour) {
    lastSentHour = currentHour;
    await sendScheduledMessage(currentHour);
  }
}

async function checkData() {
  const now = new Date();
  if (now.getMinutes() === 0) {
    try {
      const response = await axios.get(API_CURRENT_MAPS);

      const responseData = response.data;

      if (responseData[0].phaseId !== lastPhaseId) {
        console.log("Nouvelle phase trouvée");
        await sendScheduledMessage(getRoundedDate());
      }

    } catch (error) {
      console.error('Erreur:', error.message);
    }
  }
}

// Fonction pour envoyer le message programmé avec embed
async function sendScheduledMessage(hour) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.log("Canal non trouvé");
      return;
    }

    // Supprimer le dernier message si il existe
    await deletePreviousMessage();

    // Récupérer les Maps actuelles
    const response = await axios.get(API_CURRENT_MAPS);
    const responseMaps = await axios.get(API_MAPS);
    const currentMapApi = response.data;
    const maps = responseMaps.data;

    // Extraire les données
    const mapsRule = maps.rules;
    const allMaps = maps.stages;
    lastPhaseId = currentMapApi[0].phaseId;
    const currentMapRegular = currentMapApi[0].Regular.stages;
    const currentMapRanked = currentMapApi[0].Gachi.stages;
    const rankedRule = mapsRule[currentMapApi[0].Gachi.rule];
    let rankedEmoji = "";

    switch (currentMapApi[0].Gachi.rule) {
      case "Goal":
        rankedEmoji = "<:Rainmaker:1409453978143559712>"
        break;
      case "Area":
        rankedEmoji = "<:Splat_Zones:1409580663719329933>"
        break;
      case "Lift":
        rankedEmoji = "<:Tower_Control:1409453983218663434>"
        break;
    }

    // Function to load local images
    async function loadLocalImage(filePath) {
      try {
        // Vérifier si le fichier existe
        await fs.access(filePath);
        const buffer = await fs.readFile(filePath);
        return loadImage(buffer);
      } catch (error) {
        console.error(`Image non trouvée: ${filePath}`);

        // Créer une image de remplacement
        const canvas = createCanvas(100, 100);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ff0000';
        ctx.fillRect(0, 0, 100, 100);
        ctx.fillStyle = '#ffffff';
        ctx.font = '12px Arial';
        ctx.fillText('Image manquante', 10, 50);

        return canvas;
      }
    }

    // Créer l'image composite
    async function createCompositeImage(regularMapIds, rankedMapIds, rankedRule) {
      try {
        // Configuration
        const width = 1920;
        const height = 1540;
        const canvas = createCanvas(width, height);
        const ctx = canvas.getContext('2d');

        // Fond noir
        ctx.fillStyle = '#002F3136';
        ctx.fillRect(0, 0, width, height);

        // Charger toutes les images
        const [regularMap1, regularMap2, rankedMap1, rankedMap2, regularLogo, rankedLogo] = await Promise.all([
          loadLocalImage(path.join(__dirname, 'stages', `${regularMapIds[0]}.webp`)),
          loadLocalImage(path.join(__dirname, 'stages', `${regularMapIds[1]}.webp`)),
          loadLocalImage(path.join(__dirname, 'stages', `${rankedMapIds[0]}.webp`)),
          loadLocalImage(path.join(__dirname, 'stages', `${rankedMapIds[1]}.webp`)),
          loadLocalImage(path.join(__dirname, 'icons', 'Regular_Battle.webp')),
          loadLocalImage(path.join(__dirname, 'icons', `${rankedRule}.png`))
        ]);

        // Dimensions
        const imgWidth = 960;
        const imgHeight = 590;
        const logoSize = 160;
        const margin = 0;
        const sectionMargin = 0;

        // --- SECTION REGULAR BATTLE ---
        const regularSectionY = margin;

        // Logo Regular Battle au centre au-dessus
        const regularLogoX = (width - logoSize) / 2;
        ctx.drawImage(regularLogo, regularLogoX, regularSectionY, logoSize, logoSize);

        // Maps Regular en dessous du logo
        const regularMapsY = regularSectionY + logoSize + 20;

        ctx.drawImage(regularMap1, margin, regularMapsY, imgWidth, imgHeight);
        ctx.drawImage(regularMap2, width - margin - imgWidth, regularMapsY, imgWidth, imgHeight);

        // --- SECTION RANKED BATTLE ---
        const rankedSectionY = regularMapsY + imgHeight + sectionMargin;

        // Logo du mode Ranked au centre au-dessus
        const rankedLogoX = (width - logoSize) / 2;
        ctx.drawImage(rankedLogo, rankedLogoX, rankedSectionY, logoSize, logoSize);

        // Maps Ranked en dessous du logo
        const rankedMapsY = rankedSectionY + logoSize + 20;

        ctx.drawImage(rankedMap1, margin, rankedMapsY, imgWidth, imgHeight);
        ctx.drawImage(rankedMap2, width - imgWidth, rankedMapsY, imgWidth, imgHeight);

        // Sauvegarder l'image composite
        const compositePath = path.join(__dirname, 'temp', 'composite.png');
        const buffer = canvas.toBuffer('image/png');

        await fs.mkdir(path.dirname(compositePath), { recursive: true });
        await fs.writeFile(compositePath, buffer);

        return compositePath;

      } catch (error) {
        console.error('Erreur création image composite:', error);
        throw error;
      }
    }

    // Créer l'image composite
    const compositeImagePath = await createCompositeImage(
      currentMapRegular,
      currentMapRanked,
      currentMapApi[0].Gachi.rule
    );

    // Créer l'embed (encadré noir)
    const embed = new EmbedBuilder()
      .setTitle('CURRENT STAGES')
      .setColor(0x2F3136)
      .setTimestamp()
      .addFields(
        {
          name: '<:Regular_Battle:1409454604026122304> **REGULAR BATTLE**',
          value: `${allMaps[currentMapRegular[0]]}, ${allMaps[currentMapRegular[1]]}`,
          inline: true
        },
        {
          name: '\u200B',
          value: '\u200B',
          inline: true
        },
        {
          name: `<:Ranked_Battle:1409454601232584714> **RANKED BATTLE - ${rankedEmoji} ${rankedRule}**`,
          value: `${allMaps[currentMapRanked[0]]}, ${allMaps[currentMapRanked[1]]}`,
          inline: true
        }
      )
      .setImage('attachment://composite.png')

    // Envoyer l'embed
    const sentMessage = await channel.send({
      embeds: [embed],
      files: [{
        attachment: compositeImagePath,
        name: 'composite.png'
      }]
    });

    lastMessageId = sentMessage.id;
    console.log(`Embed envoyé pour ${hour}h`);

  } catch (error) {
    console.error('Erreur:', error.message);

    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await channel.send("Erreur lors de la récupération des données : " + error.message);
    }
  }
}

// Fonction pour supprimer le dernier message du bot
async function deletePreviousMessage() {
  if (!lastMessageId || !channelId) return;

  try {
    const channel = client.channels.cache.get(channelId);
    const message = await channel.messages.fetch(lastMessageId);
    await message.delete();
    console.log('Message précédent supprimé');
    return true;
  } catch (error) {
    if (error.code === 10008) { // Unknown Message
      console.log('Message déjà supprimé');
      lastMessageId = null;
    } else {
      console.log('Erreur suppression:', error.message);
    }
    return false;
  }
}

// Arroundie les heures 
function getRoundedDate(intervalHours = 2) {
  const now = new Date();
  const hours = now.getHours();
  const roundedHours = Math.floor(hours / intervalHours) * intervalHours;

  const roundedDate = new Date(now);
  roundedDate.setHours(roundedHours, 0, 0, 0);

  return roundedDate.toISOString();
}

// Fonction pour renvoyer les 3 prochaines maps
async function getNextMaps() {
  try {

    const channel = client.channels.cache.get(channelId);
    if (!channel) return console.log("❌ Canal introuvable");

    const dateTime = getRoundedDate();

    const response = await axios.get(`https://splatoon.oatmealdome.me/api/v1/one/versus/pretendo/phases?startsAfter=${dateTime}&count=4`);
    const responseMaps = await axios.get(API_MAPS);
    const nextMaps = response.data;
    const allMaps = responseMaps.data.stages;
    const mapsRule = responseMaps.data.rules;

    const fields = [];

    nextMaps.map((map, index) => {
      let rankedEmoji = "";

      switch (nextMaps[index].Gachi.rule) {
        case "Goal":
          rankedEmoji = "<:Rainmaker:1409453978143559712>"
          break;
        case "Area":
          rankedEmoji = "<:Splat_Zones:1409580663719329933>"
          break;
        case "Lift":
          rankedEmoji = "<:Tower_Control:1409453983218663434>"
          break;
      }
      const timeValue = index == 0 ? '`Now`' : `<t:${Math.floor(new Date(map.startTime).getTime() / 1000)}:t>`;
      const rankedRule = mapsRule[map.Gachi.rule];
      fields.push(
        {
          name: '🕒',
          value: timeValue,
          inline: true
        },
        {
          name: '<:Regular_Battle:1409454604026122304> **Regular Battle**',
          value: `${allMaps[map.Regular.stages[0]]}, ${allMaps[map.Regular.stages[1]]}`,
          inline: true
        },
        {
          name: `<:Ranked_Battle:1409454601232584714>** Ranked Battle - ${rankedEmoji} ${rankedRule}**`,
          value: `${allMaps[map.Gachi.stages[0]]}, ${allMaps[map.Gachi.stages[1]]}`,
          inline: true
        },
      )
      if (index != nextMaps.length - 1) {
        fields.push({
          name: '\u200B',
          value: '\u200B',
          inline: false
        });
      }
    })


    const embed = new EmbedBuilder()
      .setTitle('Future Stages')
      .setColor(0x2F3136)
      .setTimestamp()
      .addFields(fields)

    const sentMessage = await channel.send({
      embeds: [embed]
    });

    console.log(`✅ Embed rotation envoyé`);
  } catch (error) {
    console.error('❌ Erreur:', error.message);

    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await channel.send("❌ Erreur lors de la récupération des données : " + error.message);
    }
  }
}


client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;

  if (interaction.commandName === "rotation") {
    await interaction.deferReply();
    await getNextMaps();
    await interaction.deleteReply();
  }
})

// Gérer les erreurs
client.on('error', console.error);

// Connecter le bot avec le token
client.login(process.env.DISCORD_TOKEN);