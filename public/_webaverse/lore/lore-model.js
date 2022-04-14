import {murmurhash3} from './murmurhash3.js';

export const defaultPlayerName = 'Anon';
export const defaultPlayerBio = 'A new player. Not much is known about them.';
export const defaultObjectName = 'Thing';
export const defaultObjectDescription = 'A thing. Not much is known about it.';

const hash = s => murmurhash3(s).toString(16);
const thingHash = (o, index) => `${hash(o.name)}/${o.name}#${index+1}`;
const characterLore = `\
# Overview

AI anime avatars in a virtual world. They have human-level intelligence and unique and interesting personalities.
`;
export const makeLorePrompt = ({
  settings,
  characters,
  messages,
  objects,
  dstCharacter,
}) => `\
${characterLore}

Script examples:

\`\`\`
+${thingHash({name:'Character1'}, 0)}: What's the meaning of life? [emote=normal,action=none,object=none,target=none]
+${thingHash({name:'Npc1'}, 1)}: Doesn't matter. Anyway, I'll follow you Character1. [emote=happy,action=follow,object=none,target=${thingHash({name:'Character1'}, 0)}]
+${thingHash({name:'Character1'}, 0)}: Don't do that. [emote=normal,action=none,object=none,target=none]
+${thingHash({name:'Npc1'}, 1)}: Ok I'll stop. [emote=normal,action=stop,object=none,target=none]
+${thingHash({name:'Character1'}, 0)}: Come over here, Npc1! [emote=normal,action=none,object=none,target=none]
+${thingHash({name:'Npc1'}, 1)}: Ok coming. [emote=normal,action=none,object=none,target=${thingHash({name:'Character1'}, 0)}]
+${thingHash({name:'Npc1'}, 1)}: I'm going Super Saiyan mode! [emote=angry,action=supersaiyan,object=none,target=none]
+${thingHash({name:'Character1'}, 0)}: Press that button. [emote=normal,action=none,object=none,target=none]
+${thingHash({name:'Npc1'}, 1)}: What does this button do? [emote=joy,action=use,object=${'BUTTON#1'},target=none]
+${thingHash({name:'Npc1'}, 1)}: Here, Character1, take my sword. [emote=sorrow,action=give,object=${'SWORD#2'},target=${thingHash({name:'Character1'}, 0)}]
+${thingHash({name:'Npc1'}, 1)}: I'm equipping my armor. [emote=angry,action=equip,object=${'ARMOR#5'},target=none]
+${thingHash({name:'Npc1'}, 1)}: I'm dropping this potion. [emote=normal,action=drop,object=${'POTION#6'},target=none]
+${thingHash({name:'Npc1'}, 1)}: Ok Character1, I'll go get the bow. [emote=normal,action=fetch,object=${'BOW#7'},target=${thingHash({name:'Character1'}, 0)}]
\`\`\`

# Scene 1

# Setting

${settings.join('\n\n')}

## Characters

${
  characters.map((c, i) => {
    return `Id: ${thingHash(c, i)}
Name: ${c.name}
Bio: ${c.bio}
`;
  }).join('\n\n')
}

# Objects

${
  objects.map((o, i) => thingHash(o, i)).join('\n')
}

## Script (raw format)

${
  messages.map(m => {
    const characterIndex = characters.indexOf(m.character);
    const suffix = `[emote=${m.emote},action=${m.action},object=${m.object},target=${m.target}]`;
    return `+${thingHash(m.character, characterIndex)}: ${m.message} ${suffix}`;
  }).join('\n')
}
+${
  dstCharacter ? `${thingHash(dstCharacter, characters.indexOf(dstCharacter))}:` : ''
}`;

const parseLoreResponse = response => {
  let match;
  // console.log('parse lore', response, match);
  /* if (match = response?.match(/^\+([^\/]+?)\/([^#]+?)#([0-9]+?):([\s\S]*)\[emote=([\s\S]*?)\]$/)) {
    const hash = match[1];
    const name = match[2];
    const nonce = parseInt(match[3], 10);
    const message = match[4].trim();
    const emote = match[5];
    const action = 'none';
    const object = 'none';
    const target = 'none';
    return {
      hash,
      name,
      nonce,
      message,
      emote,
      action,
      object,
      target,
    };
  } else */if (match = response?.match(/^\+([^\/]+?)\/([^#]+?)#([0-9]+?):([^\[]*?)\[emote=([\s\S]*?),action=([\s\S]*?),object=([\s\S]*?),target=([\s\S]*?)\]$/)) {
    // console.log('match 1', match);
    const hash = match[1];
    const name = match[2];
    const nonce = parseInt(match[3], 10);
    const message = match[4].trim();
    const emote = match[5].trim();
    const action = match[6].trim();
    const object = match[7].trim();
    const target = match[8].trim();
    return {
      hash,
      name,
      nonce,
      message,
      emote,
      action,
      object,
      target,
    };
  } else if (match = response?.match(/^\+([^\/]+?)\/([^#]+?)#([0-9]+?):([^\[]*?)$/)) {
    // console.log('match 2', match);
    const hash = match[1];
    const name = match[2];
    const nonce = parseInt(match[3], 10);
    const message = match[4].trim();
    const emote = 'normal';
    const action = 'none';
    const object = 'none';
    const target = 'none';
    return {
      hash,
      name,
      nonce,
      message,
      emote,
      action,
      object,
      target,
    };
  } else {
    // console.log('no match', response);
    return null;
  }
};
export const makeLoreStop = (localCharacter, localCharacterIndex) => `\n+${thingHash(localCharacter, localCharacterIndex)}`;
export const postProcessResponse = (response, characters, dstCharacter) => {
  response = response.trim();
  if (dstCharacter) {
    response = `+${thingHash(dstCharacter, characters.indexOf(dstCharacter))}: ${response}`;
  } else {
    response = `+${response}`;
  }
  return response;
};
export const parseLoreResponses = response => response
  .split('\n')
  .map(s => parseLoreResponse(s))
  .filter(o => o !== null);

const commentLore = `\
AI anime avatars in a virtual world. They have human-level intelligence and unique and interesting personalities.

The tone of the series is on the surface a children's show, but with a dark subtext. It is similar to Pokemon, Dragon Ball, Rick and Morty, and South Park, but with the aesthetic of Studio Ghibli.

We want some really funny and interesting commentary to come from these avatars. They should be witty, clever, interesting, usually with a pun or a joke, and suggesting of some action that the character will perform there.

The comments are of the following form:

prompt: Exorphys Graetious
response: That sounds hard to pronounce. It must be important. Or the person who named it is an asshole. Or their parents were assholes. Just a line of assholes.

prompt: Orange Fields
response: They say a bloodstain's orange after you wash it three or four times in a tub. Still those fields sound interesting!

prompt: Amenki's Lab
response: I hate that guy Amenki and his stupid lab. I barely survived his last experiment. Maybe it's time for vengeance.

prompt: Sunscraper
response: I bet it's amazing to see the world from up there. I guess as long as you don't fall down. I'm not scared though!

prompt: Bastards bog
response: What a dump. I can't believe anyone would want to live here. The smell is terrible and the people are all dirty. I'm sorry I shouldn't be joking that they're poor.

prompt: The Great Tree
response: It's really not that great, but the music is nice. Yeah apparently they decided trees should come with music.

prompt: The Trash
response: Ugh, the dregs of society live here. It's the worst. It's just a disgusting slum. I'm honestly surprised there's not more crime.

prompt: The Park
response: It's a great place to relax! If you like dogs. I like cats more though. So you can imagine, that causes a few problems...

prompt: The Woods
response: It's so dark in there! I like it. It feels spooky and dangerous. Maybe there are monsters. And I can kill them all.

prompt: Lake Lagari
response: The water's so clear! It's really pretty. I bet the fish are delicious too. But then again, who am I to judge? I'm not a cannibal.

prompt: Dungeon of Torment
response: Don't judge me for this but I really like the dungeon. It's dark and spooky and I feel like anything could happen. It's the perfect place for a secret lair.

prompt: Tower Of Zion
response: I always get a little nervous when I see the tower. It's so tall and imposing. But then again, I bet you could throw shit down from the heavens like Zeus.

prompt: Maze of Merlillion
response: This place is so poorly designed! I'm sure nobody could ever find their way out. Unless they have a map or something. But even then, good luck.

prompt: Freaky Funkos Fried Fox
response: I'm not sure how I feel about foxes being eaten. On the one hand, they're cute. But on the other hand, they're a little too foxy.

prompt: Echidna's Den
response: It's weird that there are so many snake dens around. I mean, it's not like echidnas are poisonous or anything. Wait what, Echidnas aren't snakes?!

prompt: Fennek's Forest
response: There's a lot of fenneks in this forest. Weird that they all hang out together like that. But I guess it's better than being eaten by a lion or something.

prompt: The Abyss
response: It's so dark and scary down there! You can survive long enough to turn on your flashlight, only to be scared to death by what you reveal!

prompt: Castle of Cygnus
response: It's so cold in there! Somehow the princess can stand it. Maybe she just doesn't feel the cold. Or maybe she has a furnace.

prompt: Lost Minds Nightclub
response: You won't lose your mind here, but if you lose your mind that's where you'll end up. Then you get to party until your parents come pick you up.

prompt: Barrens of Boreas
response: False advertising! This place is nothing but a bunch of rocks. There's no water or anything. What kind of bar is this?

prompt: The End
response: People are always talking about the end, but it's just the end. What's all the fuss about? Everything that has a beginning must have an end.

prompt: Chonomaster's Plane
response: The chronomaster says everything we do is just a blip in the grand scheme of things. It makes you feel kind of small, doesn't it? I don't want ot feel small.

prompt: Gus's Charging Station
response: Do you like to wait for hours and hours just to charge? Then Gus will gladly rip you off for the privilege.

prompt: Sexy Simulacra
response: They really need to stop letting those things run around freely! They're so creepy and weird. Only the weirdos could find them sexy.

prompt: Crunchy Apple
response: The food is here really delicious! The apples are so crunchy, I bet they're made of pure sugar. They say it's really bad for you but it's irresistible.
`;
export const makeCommentPrompt = ({
  name,
}) => {
  return `\
${commentLore}
prompt: ${name}
response:`;
};
export const makeCommentStop = () => {
  return `\n`;
};
export const parseCommentResponse = response => response.replace(/^ /, '');