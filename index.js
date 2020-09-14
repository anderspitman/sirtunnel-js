const { createHoster } = require('./sirtunnel.js');


console.log(createHoster);
//const server = 'http://localhost:9001';
const server = 'https://patchbay.iobio.io';
const rootChannel = '/test';
const hoster = createHoster(server, rootChannel, { numWorkers: 4 });
