const fs = require('fs');
const path = require('path');

class EmojiString extends String {
  constructor(data) {
    super(`<${data.animated ? 'a' : ''}:${data.name}:${data.id}>`);
    this.id = data.id;
    this.name = data.name;
    this.animated = data.animated;
  }

  component() {
    return { id: this.id, name: this.name, animated: this.animated };
  }
}

function loadEmojis() {
  const emojiDir = path.join(__dirname, '..', 'emojis');
  const files = fs.readdirSync(emojiDir).filter(file => file.endsWith('.js'));
  const store = {};
  for (const file of files) {
    const data = require(path.join(emojiDir, file));
    for (const [name, value] of Object.entries(data)) {
      store[name] = new EmojiString(value);
    }
  }
  return store;
}

const em = loadEmojis();

module.exports = { em };
