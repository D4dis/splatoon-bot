import { Client, GatewayIntentBits, EmbedBuilder } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { promises as fs } from 'fs';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

// Variables pour le suivi
let lastSentHour = null;

// Quand le bot est prêt
client.once('clientReady', () => {
  console.log(`✅ Bot connecté en tant que ${client.user.tag}`);

  // Vérifier l'heure toutes les minutes
  setInterval(checkHour, 60 * 1000);

  // Vérifier immédiatement au démarrage
  checkHour();
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

// Fonction pour supprimer tous les anciens messages du bot
async function cleanupOldBotMessages() {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) return;

    // Récupérer les 100 derniers messages
    const messages = await channel.messages.fetch({ limit: 100 });

    // Filtrer les messages de ce bot
    const botMessages = messages.filter(msg => msg.author.id === client.user.id);

    // Supprimer tous les messages du bot (sauf si ça échoue)
    for (const message of botMessages.values()) {
      try {
        await message.delete();
        console.log(`🗑️ Message supprimé: ${message.id}`);
      } catch (deleteError) {
        console.log('⚠️ Impossible de supprimer un message:', deleteError.message);
      }
    }
  } catch (error) {
    console.log('⚠️ Erreur lors du nettoyage:', error.message);
  }
}

// Fonction pour envoyer le message programmé avec embed
async function sendScheduledMessage(hour) {
  try {
    const channel = client.channels.cache.get(channelId);
    if (!channel) {
      console.log("❌ Canal non trouvé");
      return;
    }

    // Récupérer les Maps actuelles
    const response = await axios.get(API_CURRENT_MAPS);
    const responseMaps = await axios.get(API_MAPS);
    const currentMapApi = response.data;
    const maps = responseMaps.data;

    // Extraire les données
    const mapsRule = maps.rules;
    const allMaps = maps.stages;
    const currentMapRegular = currentMapApi[0].Regular.stages;
    const currentMapRanked = currentMapApi[0].Gachi.stages;
    const rankedRule = mapsRule[currentMapApi[0].Gachi.rule];
    let rankedIcon = "";
    let rankedEmoji = "";

    switch (currentMapApi[0].Gachi.rule) {
      case "Goal":
        rankedIcon = "icons/Rainmaker.png";
        rankedEmoji = "<:Rainmaker:1409453978143559712>"
        break;
      case "Area":
        rankedIcon = "icons/Splat_Zones.png";
        rankedEmoji = "<:Splat_Zones:1409580663719329933>"
        break;
      case "Lift":
        rankedIcon = "icons/Tower_Control.png";
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
        console.error(`❌ Image non trouvée: ${filePath}`);

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
      .setFooter({ text: `Mise à jour • ${new Date().toLocaleTimeString('fr-FR')}` });

    // Envoyer l'embed
    await channel.send({
      embeds: [embed],
      files: [{
        attachment: compositeImagePath,
        name: 'composite.png'
      }]
    });
    console.log(`✅ Embed envoyé pour ${hour}h`);

  } catch (error) {
    console.error('❌ Erreur:', error.message);

    const channel = client.channels.cache.get(channelId);
    if (channel) {
      await channel.send("❌ Erreur lors de la récupération des données : " + error.message);
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
    console.log('🗑️ Message précédent supprimé');
    return true;
  } catch (error) {
    if (error.code === 10008) { // Unknown Message
      console.log('⚠️ Message déjà supprimé');
      lastMessageId = null;
    } else {
      console.log('⚠️ Erreur suppression:', error.message);
    }
    return false;
  }
}

// Utilisation
await deletePreviousMessage();

// Gérer les erreurs
client.on('error', console.error);

// Connecter le bot avec le token
client.login(process.env.DISCORD_TOKEN);