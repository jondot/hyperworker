const L = require('lodash')
const Queue = require('bull')
const fs = require('fs')
const path = require('path')

class Worker {
  static get queueName() {
    return this.__queueName || 'system'
  }
  static get tag() {
    return `${this.name}(${this.queueName})`
  }
  static log(message, ...args) {
    this.__log(`${this.tag}: ${message}`, ...args)
  }
  log(...args) {
    this.constructor.log(...args)
  }
  static performLater(data, opts) {
    if (this.queue) {
      this.queue.add(this.name, data)
      if (this.log) {
        this.log(`${this.tag}: added`, {
          data,
          opts
        })
      }
    } else {
      throw new Error(`${this.tag}: queue is not initialized`)
    }
  }
}

const queue = (name, opts) => target => {
  target.__queueName = name
}

const { EmailTemplate } = require('email-templates')

@queue('mailers')
class Mailer extends Worker {
  async perform({ data }) {
    if (data.template) {
      const tmpl = new EmailTemplate(
        `${this.constructor.templates}/${data.template}`
      )
      const res = await tmpl.render(data.locals)
      // fill in what's missing from data (subject, html, text)
      data = Object.assign({}, res, data)
      delete data.template
      delete data.locals
    }
    this.log(`sending email to: ${data.to}`, data)
    const info = await this.constructor.__sendMail(data)
    this.log(`sent email to: ${data.to}`, info)
  }
  static mail(mail, opts) {
    this.performLater(Object.assign({}, this.defaults, mail))
  }
}

const dirToWorkers = dir => {
  const files = fs.readdirSync(dir)
  const modules = L.map(L.filter(files, _ => _.match(/\.js$/)), _ =>
    require(path.join(dir, _))
  )
  const workers = L.filter(modules, _ => _.queueName)
  return workers
}

// workers: [string|Worker]
// - string   a directory to scan.
// - Worker   a previously required worker.
const discoverWorkers = (workers, opts) => {
  // join discovered workers from dirs and those
  // that were required explicitly and handed over.
  const dirsAndWorkers = L.groupBy(
    workers,
    _ => (_.queueName ? 'workers' : 'dirs')
  )
  const discoveredWorkers = L.flatMap(dirsAndWorkers['dirs'], dirToWorkers)
  const allWorkers = L.concat(
    dirsAndWorkers.workers || [],
    discoveredWorkers || []
  )
  opts.log('discovered workers:', allWorkers)
  return allWorkers
}

const init = (workers, opts) => {
  opts.log = opts.log || console.log
  opts.queueConfigs = opts.queueConfigs || {}

  // worker
  Worker.__log = opts.log

  // mailer
  let sendMail = function() {
    this.log('WARNING: this mailer does nothing. Please set up transport.')
  }
  if (opts.mailTransport) {
    const transport = opts.mailTransport
    const Promise = require('bluebird')
    sendMail = Promise.promisify(transport.sendMail, {
      context: transport
    })
  } else {
    opts.log('Warning: no email transport set.')
  }
  Mailer.__sendMail = sendMail
  Mailer.templates = opts.mailTemplates || './app/mailers'

  // {
  //    'system':[W1, W2],
  //    'highpriority': [W3]
  // }
  const allWorkers = discoverWorkers(workers, opts)

  const workermap = L.groupBy(allWorkers, w => w.queueName)
  const queues = L.map(workermap, (ws, queueName) => {
    opts.log(`Registering: [${L.map(ws, _ => _.name)}] on (${queueName})`)
    const queue = new Queue(
      queueName,
      opts.queueConfigs[queueName] || 'redis://localhost:6379'
    )
    queue.on('error', err => {
      opts.log(`${queueName}: ERROR`, err)
    })
    L.each(ws, w => {
      w.queue = queue
      if (opts.runWorkers) {
        queue.process(w.name, 1, data => {
          opts.log(`${w.tag} -- invoking`)
          const job = new w()
          job.perform(data)
          opts.log(`${w.tag} -- invoked`)
        })
        opts.log(`${w.tag} -- running on this process`)
      }
    })
    return queue
  })

  return queues
}

module.exports = { Worker, Mailer, queue, init }
