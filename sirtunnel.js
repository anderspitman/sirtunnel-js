const http = require('http');
const https = require('https');


class Hoster {
  constructor(server, rootChannel, options) {
    this.server = server;
    this.rootChannel = rootChannel;

    this.files = {};

    let numWorkers = 4;
    if (options) {
      if (options && options.numWorkers) {
        numWorkers = options.numWorkers;
      }
    }

    for (let i = 0; i < numWorkers; i++) {
      this.hostFileWorker(i);
    }
  }

  async hostFile(file, path) {
    this.files[path] = file;
  }

  async hostFileWorker(workerId) {

    while (true) {

      const switchUrl = this.server + '/res' + this.rootChannel + '?switch=true';
      const randChan = randomChannelId();

      const res = await new Promise((resolve, reject) => {
        const req = https.request(switchUrl, {
          method: 'POST',
        }, resolve);

        req.write(randChan);
        req.end();
      });

      let reqMethod;
      let reqPath;

      const reqHeaders = {};
      for (const headerName in res.headers) {
        if (headerName === 'pb-method') {
          reqMethod = res.headers[headerName];
        }
        else if (headerName === 'pb-path') {
          reqPath = res.headers[headerName];
        }
        else if (headerName.startsWith('pb-h-')) {
          reqHeaders[headerName.slice('pb-h-'.length)] = res.headers[headerName];
        }
      }

      console.log(workerId, reqMethod, reqPath, reqHeaders);

      const upstreamRes = await new Promise((resolve, reject) => {
        const upstreamReq = http.request('http://localhost:9002' + reqPath, {
          method: reqMethod,
          headers: reqHeaders,
        }, resolve);

        upstreamReq.on('error', (err) => {
          console.log("upstreamReq err");
          console.error(err);
        });

        res.pipe(upstreamReq);
      });

      upstreamRes.on('error', (err) => {
        console.error(err);
      });

      const resHeaders = {
        'Pb-Status': upstreamRes.statusCode.toString(),
      };

      for (const headerName in upstreamRes.headers) {
        resHeaders['Pb-H-' + headerName] = upstreamRes.headers[headerName];
      }

      const proxyUrl = this.server + '/res/' + randChan;

      await new Promise((resolve, reject) => {
        const proxyReq = https.request(proxyUrl, {
          method: 'POST',
          headers: resHeaders,
        }, resolve);

        proxyReq.on('error', (err) => {
          console.log("proxyReq err");
          console.error(err);
        });

        upstreamRes.pipe(proxyReq);
      });
    }
  }
}

function createHoster(server, rootChannel, options) {
  return new Hoster(server, rootChannel, options);
}

function randomChannelId() {
  const possible = "0123456789abcdefghijkmnpqrstuvwxyz";

  function genCluster() {
    let cluster = "";
    for (let i = 0; i < 32; i++) {
      const randIndex = Math.floor(Math.random() * possible.length);
      cluster += possible[randIndex];
    }
    return cluster;
  }

  let id = "";
  id += genCluster();
  //id += '-';
  //id += genCluster();
  //id += '-';
  //id += genCluster();
  return id;
}

module.exports = {
  createHoster,
};
