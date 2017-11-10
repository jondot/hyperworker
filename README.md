# Hyperworker

A rapid, ES6 based, background worker and mailer infrastructure for node.js based on [bull](https://github.com/OptimalBits/bull).

## Quick Start

Add and initialize hyperworker:

```
$ cd your-project
$ yarn add hyperworker
$ hyperworker init app
```

You can run workers as part of an existing service process,
or in a separate one with the `runWorkers` flag on `init`. 


Below is a full default hyperwork config that does the following:

- Lays out `bull` queue configuration
- Discovers and registers `mailers` and `workers` for service use
- Loads `nodemailer`
- Runs workers in a diffeent process if the `HYPERWORK` env var is set
- Configures Arena, the `bull` UI and exports it for use by a service

```javascript
// src/
//   app/
//     mailers/
//     workers/
//   config/
//     hyperwork.js
//     nodemailer.js
require('babel-register')
const runWorkers = !!process.env.HYPERWORK

const { init } = require('hyperwork')
const mailTransport = require('./nodemailer')

const path = require('path')

const queueConfigs = {
  mailers: {
    name: 'mailers',
    port: 6379,
    host: '127.0.0.1',
    hostId: 'localhost'
  },
  system: {
    name: 'system',
    port: 6379,
    host: '127.0.0.1',
    hostId: 'localhost'
  }
}

init(
  [
    path.join(__dirname, '../app/mailers'),
    path.join(__dirname, '../app/workers') /* CleanupWorker, DatabaseVaccum */
  ],
  {
    log: console.log,
    mailTransport,
    runWorkers,
    queueConfigs
  }
)
const Arena = require('bull-arena')
const hyperworkAdmin = Arena({ queues: queueConfigs })

module.exports = {
  hyperworkAdmin
}
```

## Background Worker

```javascript
const { Worker } = require('hyperwork')

class CleanupWorker extends Worker {
  async perform({ data }) {
    await request('http://foobar.com'+data.id)
    console.log('worker: cleaned up')
  }
}
module.exports = CleanupWorker
```

## Mailer

Build a mailer like so:

```javascript
const { Mailer } = require('hyperwork')
class RegistrationMailer extends Mailer {
  static defaults = {
    from: 'acme <acme@acme.org>'
  }

  static sendWelcome(user) {
    // https://nodemailer.com/message/
    this.mail({
      to: user.email,
      template: 'welcome',
      locals: {
        bill: '$13'
      }
    })
  }
}

module.exports = RegistrationMailer
```

And place templates (if you specify one, like above) like this:

```
mailers/
  registration-mailer.js
  welcome/
    html.ejs
    text.ejs
    subject.ejs
```

In each, you can use `locals` as an immediately available variable:

```html
(html.ejs)
<br/> you owe <%= bill %>
```

# Contributing

Fork, implement, add tests, pull request, get my everlasting thanks and a respectable place here :).


### Thanks:

To all [Contributors](https://github.com/jondot/hyperworker/graphs/contributors) - you make this happen, thanks!


# Copyright

Copyright (c) 2017 [Dotan Nahum](http://gplus.to/dotan) [@jondot](http://twitter.com/jondot). See [LICENSE](LICENSE.txt) for further details.
