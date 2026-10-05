const fs = require('fs');
const path = require('path');

function loadEvents(client) {
  const eventsDir = path.join(__dirname, '..', 'events');
  const files = fs.readdirSync(eventsDir).filter(file => file.endsWith('.js'));
  for (const file of files) {
    const event = require(path.join(eventsDir, file));
    const runner = (...args) => {
      Promise.resolve(event.execute(...args)).catch(error => {
        console.error(`Error in event ${event.name}:`, error);
      });
    };
    if (event.once) {
      client.once(event.name, runner);
    } else {
      client.on(event.name, runner);
    }
  }
}

module.exports = { loadEvents };
