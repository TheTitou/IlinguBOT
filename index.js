const { Client, MessageEmbed } = require("discord.js");
const { config } = require("dotenv");
const firebase = require("firebase/app");
const admin = require("firebase-admin");
const { promptMessage } = require("./functions");
const randomPuppy = require("random-puppy");

// Initialize Firebase
const serviceAccount = require("./serviceAccount.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

// Config
const client = new Client({
  disableMentions: "everyone",
});
config({
  path: __dirname + "/.env",
});

// Init CheckUrl
const lookup = require("safe-browse-url-lookup")({
  apiKey: process.env.GOOGLETOKEN,
});

// Var
const chooseArr = ["⛰", "🧻", "✂"];
// let ignored = false;

// Fn
const POSTMessage = (AllMessage, channel, MessageID, guild) => {
  // 172800000 -> Ms of 2days
  // 432000000 => Ms of 5days
  db.collection("guilds")
    .doc(guild)
    .update({
      messageImageToSuppr:
        AllMessage === false
          ? [
              {
                channel,
                MessageID,
                TimeStamp: Date.now() + 432000000,
              },
            ]
          : [
              ...AllMessage,
              {
                channel,
                MessageID,
                TimeStamp: Date.now() + 432000000,
              },
            ],
    });
};

const UpdateMessageVar = (Data, guild) => {
  db.collection("guilds").doc(guild).update({
    messageImageToSuppr: Data,
  });
};

const GetLevel = (guild) => {
  return new Promise((resolve, reject) => {
    db.collection("guilds")
      .doc(guild)
      .get()
      .then((doc) => {
        if (doc.exists) {
          resolve(doc.data().levels);
        } else {
          reject("No such document!");
        }
      })
      .catch(reject);
  });
};

const LevelUp = (User, guild, Data) => {
  let AllData = { ...Data };
  AllData[User].xp += Math.round(Math.random() * 10) + 2;
  AllData[User].nbMsg += 1;

  if (AllData[User].xp >= 150 && Math.round(Math.random() * 10) <= 5) {
    AllData[User].xp = 0;
    AllData[User].lvl += 1;
    const channel = client.channels.cache.find((ch) => ch.name === "annonces");

    channel.send(
      `${
        client.users.cache.find((us) => us.id === User).username
      }!\n✅Tu passes niv.${AllData[User].lvl}!`
    );
  }

  db.collection("guilds").doc(guild).update({
    levels: AllData,
  });
};

const CheckLevelUpUser = async (User, guild) => {
  try {
    const Level = await GetLevel(guild);
    if (Level[User]) LevelUp(User, guild, Level);
    else
      db.collection("guilds")
        .doc(guild)
        .update({
          levels: {
            ...Level,
            [User]: {
              xp: Math.round(Math.random() * 10) + 2,
              lvl: 0,
              nbMsg: 1,
            },
          },
        });
  } catch (err) {
    console.error(err);
  }
};

function isValidHttpUrl(string) {
  try {
    new URL(string);
    return true;
  } catch (_) {
    return false;
  }
}

// BOT
client.on("ready", () => {
  console.log(`I'm now online, my name is ${client.user.username}`);
  client.user.setActivity("du porno ^^", {
    type: "WATCHING",
  });
});

client.on("guildMemberAdd", async (member) => {
  const role = member.guild.roles.cache.find(
    (role) => role.name === "Epic G@m3r"
  );
  member.roles.add(role);
  const subReddits = ["dankmeme", "meme", "me_irl", "PewdiepieSubmissions"];
  const random = subReddits[Math.floor(Math.random() * subReddits.length)];
  const img = await randomPuppy(random);
  const embed = new MessageEmbed()
    .setColor("RANDOM")
    .setImage(img)
    .setTitle(`From r/${random} (Reddit)`)
    .setURL(`https://reddit.com/r/${random}`);

  const channel = member.guild.channels.cache.find(
    (ch) => ch.name === "🔥général"
  );

  channel.send(`<@everyone>\nBienvenue <@${member.user.id}> !`);
  channel.send(embed);
});

client.on("guildMemberRemove", async (member) => {
  const channel = member.guild.channels.cache.find(
    (ch) => ch.name === "🔥général"
  );
  channel.send(
    `<@everyone>\nSayonara <@${member.user.id}> 😥 (tu nous manqueras pas ^^)`
  );
});

client.on("emojiCreate", async (emoji) => {
  const channel = emoji.guild.channels.cache.find(
    (ch) => ch.name === "annonces"
  );
  const Author = await emoji.fetchAuthor();
  channel.send(
    `Un nouveau emoji a été ajouté ( emoji: <:${emoji.name}:${emoji.id}> ajouter par: <@${Author.id}> )`
  );
});

client.on("guildCreate", async (gData) => {
  db.collection("guilds").doc(gData.id).set({
    guildID: gData.id,
    guildName: gData.name,
    messageImageToSuppr: [],
    levels: {},
  });
});

client.on("message", async (message) => {
  const prefix = "_";
  const args = message.content.slice(prefix.length).trim().split(/ +/g);
  const cmd = args.shift().toLowerCase();

  if (!message.guild) {
    // DM
    if (message.author.bot) return;
    if (!message.content.startsWith(prefix))
      return message.reply(
        "Comment te dire que t'es dans mon espace privée là... Baaaaaka\n Genre on ta jamais appris à respecter la vie privée des gens."
      );
    return;
  }

  // Img Suppr
  const guild = message.guild.id,
    channel = message.channel.id,
    MessageID = message.id;
  if (message.attachments.size > 0) {
    db.collection("guilds")
      .doc(guild)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const Data = doc.data().messageImageToSuppr;
          if (Data) POSTMessage(Data, channel, MessageID, guild);
          else POSTMessage(false, channel, MessageID, guild);
        } else {
          console.log("No such document!");
        }
      })
      .catch(console.error);
  } else {
    // Check MsgImg
    db.collection("guilds")
      .doc(guild)
      .get()
      .then((doc) => {
        if (doc.exists) {
          const Data = doc.data().messageImageToSuppr;
          if (Data) {
            Data.forEach((Msg, i) => {
              if (Msg.TimeStamp <= Date.now()) {
                const channelOfMessage = client.channels.cache.find(
                  (ch) => ch.id === Msg.channel
                );
                channelOfMessage.messages
                  .fetch(Msg.MessageID)
                  .then((msgSupp) => {
                    msgSupp.delete();
                  })
                  .catch(console.error);
                Data.splice(i, 1);
                UpdateMessageVar(Data, guild);
              }
            });
          }
        } else {
          console.log("No such document!");
        }
      })
      .catch(console.error);
  }

  if (message.channel.name === "annonces") {
    const EmojiVu = message.guild.emojis.cache.find(
      (emoji) => emoji.name == "Vu"
    );
    message.react(message.guild.emojis.cache.get(EmojiVu.id));
  }
  if (message.author.bot) return;
  // Leveling Sys
  CheckLevelUpUser(message.author.id, guild);

  if (
    typeof message.content === "string" &&
    isValidHttpUrl(message.content) &&
    message.channel.name !== "🔗partage" &&
    !message.content.includes(".gif") &&
    !message.content.includes("-gif") &&
    !message.content.includes("discord.com")
  ) {
    const channelPartage = message.guild.channels.cache.find(
      (ch) => ch.name === "🔗partage"
    );

    channelPartage.send(
      `(Message de <@${message.author.id}>)\n${message.content}`
    );

    message
      .reply(
        `Votre message a été déplacé dans <#${channelPartage.id}> car il s'agit d'un lien.`
      )
      .then((m) => m.delete({ timeout: 7000 }));
    if (message.deletable) message.delete();
    return;
  }

  // Distribué
  // const EmojiDistri = message.guild.emojis.cache.find(
  //   (emoji) => emoji.name == "distribuer"
  // );
  // message
  //   .react(message.guild.emojis.cache.get(EmojiDistri.id))
  //   .then((messageReaction) => {
  //     setTimeout(() => {
  //       messageReaction.remove();
  //     }, 1000);
  //   });
  // ------

  if (!message.content.startsWith(prefix)) return;

  if (cmd === "ping") {
    if (message.deletable) message.delete();
    const msg = await message.channel.send(`🏓 Pinging...`);
    const ping = Date.now() - message.createdTimestamp;

    msg.edit(
      `🏓 Pong\n✔✔ <@${
        message.author.id
      }> votre Ping est de **${ping} ms** ✔✔\nPS: Un ping supérieur à 125ms devient problèmatique\n*(Ping client **${Math.floor(
        msg.createdAt - message.createdAt
      )} ms** -> à part si vous connaissez il ne vous servira à rien...)*`
    );
  } else if (cmd === "check") {
    if (args.length < 1)
      return message
        .reply("Comment veut tu que je vérifie une url inexistante -_- ?!")
        .then((m) => m.delete({ timeout: 5000 }));
    if (
      typeof args[0] === "string" &&
      args[0].trim().length !== 0 &&
      isValidHttpUrl(args[0])
    ) {
      lookup
        .checkSingle(args[0])
        .then((isMalicious) => {
          console.log(args[0], isMalicious);
          if (isMalicious) {
            message.channel.send(
              `❌**<@${message.author.id}>! NE CLICK SURTOUT PAS ! C'EST UNE URL INFÉCTÉE ET DANGEREUSE ! ELLE EST L'INCARNATION DU DIABLE !!!**❌`
            );
          } else {
            message.channel.send(
              `🔰<@${message.author.id}>, cette URL n'est à première vue pas dangereuse, tous les tests indique qu'elle est safe, maintenant on est sur internet alors soi prudent (http et https par exemple...)🔰`
            );
          }
        })
        .catch((err) => {
          console.log("Something went wrong.");
          console.error(err);
        });
    } else {
      return message
        .reply("Merci de me donner une url **VALIDE**")
        .then((m) => m.delete({ timeout: 5000 }));
    }
  } else if (cmd === "say") {
    if (message.deletable) message.delete();

    if (args.length < 1)
      return message
        .reply("Nothings to say ?")
        .then((m) => m.delete({ timeout: 5000 }));

    const roleColor = message.guild.me.displayHexColor;

    if (args[0].toLowerCase() === "embed") {
      const embed = new MessageEmbed()
        .setColor(roleColor)
        .setDescription(args.slice(1).join(" "))
        .setTimestamp()
        .setAuthor(message.author.username, message.author.displayAvatarURL())
        .setFooter(client.user.username, client.user.displayAvatarURL());
      message.channel.send(embed);
    } else if (args[0].toLowerCase() === "embedimg") {
      const embed = new MessageEmbed()
        .setColor(roleColor)
        .setDescription(args.slice(1).join(" "))
        .setTimestamp()
        .setImage(client.user.displayAvatarURL())
        .setAuthor(message.author.username, message.author.displayAvatarURL())
        .setFooter(client.user.username, client.user.displayAvatarURL());

      message.channel.send(embed);
    } else {
      message.channel.send(args.join(" "));
    }
  } else if (cmd === "rps") {
    const roleColor = message.guild.me.displayHexColor;

    const embed = new MessageEmbed()
      .setColor(roleColor)
      .setFooter(message.guild.me.displayName, client.user.displayAvatarURL())
      .setDescription(
        "Ajoute une réaction à un des ces emojis to play the game !"
      )
      .setTimestamp();

    const m = await message.channel.send(embed);
    const reacted = await promptMessage(m, message.author, 30, chooseArr);

    const botChoise = chooseArr[Math.floor(Math.random() * chooseArr.length)];

    const result = await getResult(reacted, botChoise);
    await m.reactions.removeAll();

    embed.setDescription("").addField(result, `${reacted} vs ${botChoise}`);
    m.edit(embed);

    function getResult(me, clientChosen) {
      if (
        (me === "⛰" && clientChosen === "✂") ||
        (me === "🧻" && clientChosen === "⛰") ||
        (me === "✂" && clientChosen === "🧻")
      ) {
        return "Tu as gagné(e) !";
      } else if (me === clientChosen) {
        return "C'est une égalité";
      } else {
        return "Ooooo non, tu as perdu(e) !";
      }
    }
  } else if (cmd === "lvl") {
    const UserLvl = (await GetLevel(guild))[message.author.id];
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle(`⭕Niveau de <@${message.author.id}>⭕`)
      .setDescription(
        `**Ton niveau**: __${UserLvl.lvl}__\n**Ton XP**: __${UserLvl.xp}__\n**Nombres de messages au total**:__${UserLvl.nbMsg}__\n\n(PS: pour passer niveau supérieur il faut avoir minimun 150xp + un peu de chance 😋)`
      )
      .setTimestamp()
      .setAuthor(message.author.username, message.author.displayAvatarURL())
      .setFooter(client.user.username, client.user.displayAvatarURL());

    message.channel.send(Embed);
  } else if (cmd === "help") {
    if (message.deletable) message.delete();
    const Embed = new MessageEmbed()
      .setColor(0xffc300)
      .setTitle("Comment utiliser IlinguBOT ?")
      .setDescription(
        `
      _ping: affiche ton ping
      _lvl: affiche ton niveau sur le serv
      _say <ton message>: dit un message de façon anonyme
      \t_say embed <ton message>: dit un message avec un embed
      \t_say embedimg <ton message>: dit in message avec un embed imagé
      _rps: fait un pierre-feuilles-ciseaux avec le bot
      _meme: (à faire dans le salon meme) met un meme aléatoirement
      _rda x x: te donne un nombre aléatoirement entre le 1er x et le 2ème, ex: _rda 5 8 (nombre aléatoire entre 5 et 8)
      _timer <time> (ex: _timer 1min30s / _timer 120s), MAXIMUN = 2H/MINIMUM = 10S
    `
      )
      .setTimestamp()
      .setAuthor(message.author.username, message.author.displayAvatarURL())
      .setFooter(client.user.username, client.user.displayAvatarURL());

    return message.reply(Embed);
  } else if (cmd === "meme") {
    const subReddits = ["dankmeme", "meme", "me_irl", "PewdiepieSubmissions"];
    const random = subReddits[Math.floor(Math.random() * subReddits.length)];

    const img = await randomPuppy(random);
    const embed = new MessageEmbed()
      .setColor("RANDOM")
      .setImage(img)
      .setTitle(`From r/${random} (Reddit)`)
      .setURL(`https://reddit.com/r/${random}`);
    message.channel.send(embed);
    if (message.deletable) message.delete();
  } else if (cmd === "timer") {
    const Time = args[0];

    if (message.deletable) message.delete();

    if (!Time)
      return message
        .reply("No Time for a Timer ? Are u serious ?")
        .then((m) => m.delete({ timeout: 6000 }));

    const filter = (reaction, user) => {
      return reaction.emoji.name === "Reverse" && user.id === message.author.id;
    };

    if (Time.split("min").length > 1 && Time.split("min")[1] === "") {
      const Minutes = parseInt(Time.split("min")[0]);

      if (isNaN(Minutes))
        return message
          .reply("This is not a valide time")
          .then((m) => m.delete({ timeout: 6000 }));

      if (Minutes > 120)
        return message
          .reply(
            "Merci de ne pas exéder un temps de 2H max pour ne pas trop surchager mon BOT"
          )
          .then((m) => m.delete({ timeout: 10000 }));
      if (Minutes < 1)
        return message
          .reply(
            "Merci de mettre au minimum un temps de 1min quand vous utiliser les minutes"
          )
          .then((m) => m.delete({ timeout: 10000 }));

      let MinutesInS = Minutes * 60;
      const InMs = Minutes * 60000;
      const NumberToSoustracteAtEachInterval = Math.round(MinutesInS / 10);

      const m = await message.channel.send(
        `<@${message.author.id}> : Fin du minuteur dans ${MinutesInS} secondes`
      );
      const TheInterval = setInterval(() => {
        MinutesInS -= NumberToSoustracteAtEachInterval;
        m.edit(
          `<@${message.author.id}> : Fin du minuteur dans ${MinutesInS} secondes`
        );
      }, Math.round(MinutesInS / 10) * 1000);
      const TheTimeout = setTimeout(() => {
        clearInterval(TheInterval);
        message.channel.send(
          `<@${message.author.id}> : Fin du minuteur ! Temps écoulé.`
        );
        if (m.deletable) m.delete();
      }, InMs);
      m.awaitReactions(filter, {
        max: 1,
        time: MinutesInS * 1000,
        errors: ["time"],
      })
        .then((collected) => {
          clearInterval(TheInterval);
          clearTimeout(TheTimeout);
          message.channel.send(
            `<@${message.author.id}> : Fin du minuteur ! Minuteur annulé.`
          );
          if (m.deletable) m.delete();
        })
        .catch(console.error);
    } else if (Time.split("min").length > 1 && Time.split("min")[1] !== "") {
      const Minutes = parseInt(Time.split("min")[0]);
      const Secondes = parseInt(Time.split("min")[1]);

      if (isNaN(Minutes) || isNaN(Secondes))
        return message
          .reply("This is not a valide time")
          .then((m) => m.delete({ timeout: 6000 }));
      if (Minutes * 60 + Secondes > 7200)
        return message
          .reply(
            "Merci de ne pas exéder un temps de 2H max pour ne pas trop surchager mon BOT"
          )
          .then((m) => m.delete({ timeout: 10000 }));
      if (Minutes * 60 + Secondes < 10)
        return message
          .reply("Merci de mettre au minimum un temps de 10s")
          .then((m) => m.delete({ timeout: 10000 }));

      let InS = Minutes * 60 + Secondes;
      const InMs = Minutes * 60000 + Secondes * 1000;
      const NumberToSoustracteAtEachInterval = Math.round(InS / 10);

      const m = await message.channel.send(
        `<@${message.author.id}> : Fin du minuteur dans ${InS} secondes`
      );
      const TheInterval = setInterval(() => {
        InS -= NumberToSoustracteAtEachInterval;
        m.edit(
          `<@${message.author.id}> : Fin du minuteur dans ${InS} secondes`
        );
      }, Math.round(InS / 10) * 1000);
      const TheTimeout = setTimeout(() => {
        clearInterval(TheInterval);
        message.channel.send(
          `<@${message.author.id}> : Fin du minuteur ! Temps écoulé.`
        );
        if (m.deletable) m.delete();
      }, InMs);
      m.awaitReactions(filter, {
        max: 1,
        time: InS * 1000,
        errors: ["time"],
      })
        .then((collected) => {
          clearInterval(TheInterval);
          clearTimeout(TheTimeout);
          message.channel.send(
            `<@${message.author.id}> : Fin du minuteur ! Minuteur annulé.`
          );
          if (m.deletable) m.delete();
        })
        .catch(console.error);
    } else {
      let Secondes = parseInt(Time.split("s"));

      if (isNaN(Secondes))
        return message
          .reply("This is not a valide time")
          .then((m) => m.delete({ timeout: 6000 }));

      if (Secondes > 7200)
        return message
          .reply(
            "Merci de ne pas exéder un temps de 2H max pour ne pas trop surchager mon BOT"
          )
          .then((m) => m.delete({ timeout: 10000 }));
      if (Secondes < 10)
        return message
          .reply("Merci de mettre au minimum un temps de 10s")
          .then((m) => m.delete({ timeout: 10000 }));

      const InMs = Secondes * 1000;
      const NumberToSoustracteAtEachInterval = Math.round(Secondes / 10);

      const m = await message.channel.send(
        `<@${message.author.id}> : Fin du minuteur dans ${Secondes} secondes`
      );
      const TheInterval = setInterval(() => {
        Secondes -= NumberToSoustracteAtEachInterval;
        m.edit(
          `<@${message.author.id}> : Fin du minuteur dans ${Secondes} secondes`
        );
      }, Math.round(Secondes / 10) * 1000);
      const TheTimeout = setTimeout(() => {
        clearInterval(TheInterval);
        message.channel.send(
          `<@${message.author.id}> : Fin du minuteur ! Temps écoulé.`
        );
        if (m.deletable) m.delete();
      }, InMs);
      m.awaitReactions(filter, {
        max: 1,
        time: Secondes * 1000,
        errors: ["time"],
      })
        .then((collected) => {
          clearInterval(TheInterval);
          clearTimeout(TheTimeout);
          message.channel.send(
            `<@${message.author.id}> : Fin du minuteur ! Minuteur annulé.`
          );
          if (m.deletable) m.delete();
        })
        .catch(console.error);
    }
  } else if (cmd === "rda") {
    if (message.deletable) message.delete();

    const roleColor = message.guild.me.displayHexColor;

    if (
      args[0] !== undefined &&
      args[1] !== undefined &&
      args.length <= 2 &&
      typeof parseInt(args[0]) === "number" &&
      typeof parseInt(args[1]) === "number"
    ) {
      const Biggest = [parseInt(args[0]), parseInt(args[1])].sort();
      const toRandomised = Biggest[0] - Biggest[1];

      const embed = new MessageEmbed()
        .setColor(roleColor)
        .setDescription(
          `Résutat du nombre aléatoire entre ${Biggest[0]} et ${Biggest[1]}:
              ${Biggest[1] + Math.round(Math.random() * toRandomised)}
          `
        )
        .setTimestamp()
        .setAuthor(message.author.username, message.author.displayAvatarURL())
        .setFooter(client.user.username, client.user.displayAvatarURL());
      message.channel.send(embed);
    } else {
      message.channel
        .send(
          "_rda est un commande demandant 2 chiffres.\n\t En outre ça doit ressembler à ça: _rda x x\n EXEMPLE: _rda 5 9 (nombres aléatoire en 5 et 9)"
        )
        .then((m) => m.delete({ timeout: 15000 }));
    }
  } else {
    if (message.deletable) message.delete();
  }
});

client.login(process.env.TOKEN);
