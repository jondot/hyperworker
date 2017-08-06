'use strict';

var _regenerator = require('babel-runtime/regenerator');

var _regenerator2 = _interopRequireDefault(_regenerator);

var _assign = require('babel-runtime/core-js/object/assign');

var _assign2 = _interopRequireDefault(_assign);

var _asyncToGenerator2 = require('babel-runtime/helpers/asyncToGenerator');

var _asyncToGenerator3 = _interopRequireDefault(_asyncToGenerator2);

var _getPrototypeOf = require('babel-runtime/core-js/object/get-prototype-of');

var _getPrototypeOf2 = _interopRequireDefault(_getPrototypeOf);

var _possibleConstructorReturn2 = require('babel-runtime/helpers/possibleConstructorReturn');

var _possibleConstructorReturn3 = _interopRequireDefault(_possibleConstructorReturn2);

var _inherits2 = require('babel-runtime/helpers/inherits');

var _inherits3 = _interopRequireDefault(_inherits2);

var _classCallCheck2 = require('babel-runtime/helpers/classCallCheck');

var _classCallCheck3 = _interopRequireDefault(_classCallCheck2);

var _createClass2 = require('babel-runtime/helpers/createClass');

var _createClass3 = _interopRequireDefault(_createClass2);

var _dec, _class;

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

var L = require('lodash');
var Queue = require('bull');
var fs = require('fs');
var path = require('path');

var Worker = function () {
  function Worker() {
    (0, _classCallCheck3.default)(this, Worker);
  }

  (0, _createClass3.default)(Worker, [{
    key: 'log',
    value: function log() {
      var _constructor;

      (_constructor = this.constructor).log.apply(_constructor, arguments);
    }
  }], [{
    key: 'log',
    value: function log(message) {
      for (var _len = arguments.length, args = Array(_len > 1 ? _len - 1 : 0), _key = 1; _key < _len; _key++) {
        args[_key - 1] = arguments[_key];
      }

      this.__log.apply(this, [this.tag + ': ' + message].concat(args));
    }
  }, {
    key: 'performLater',
    value: function performLater(data, opts) {
      if (this.queue) {
        this.queue.add(this.name, data);
        if (this.log) {
          this.log(this.tag + ': added', {
            data: data,
            opts: opts
          });
        }
      } else {
        throw new Error(this.tag + ': queue is not initialized');
      }
    }
  }, {
    key: 'queueName',
    get: function get() {
      return this.__queueName || 'system';
    }
  }, {
    key: 'tag',
    get: function get() {
      return this.name + '(' + this.queueName + ')';
    }
  }]);
  return Worker;
}();

var queue = function queue(name, opts) {
  return function (target) {
    target.__queueName = name;
  };
};

var _require = require('email-templates'),
    EmailTemplate = _require.EmailTemplate;

var Mailer = (_dec = queue('mailers'), _dec(_class = function (_Worker) {
  (0, _inherits3.default)(Mailer, _Worker);

  function Mailer() {
    (0, _classCallCheck3.default)(this, Mailer);
    return (0, _possibleConstructorReturn3.default)(this, (Mailer.__proto__ || (0, _getPrototypeOf2.default)(Mailer)).apply(this, arguments));
  }

  (0, _createClass3.default)(Mailer, [{
    key: 'perform',
    value: function () {
      var _ref = (0, _asyncToGenerator3.default)(_regenerator2.default.mark(function _callee(_ref2) {
        var data = _ref2.data;
        var tmpl, res, info;
        return _regenerator2.default.wrap(function _callee$(_context) {
          while (1) {
            switch (_context.prev = _context.next) {
              case 0:
                if (!data.template) {
                  _context.next = 8;
                  break;
                }

                tmpl = new EmailTemplate(this.constructor.templates + '/' + data.template);
                _context.next = 4;
                return tmpl.render(data.locals);

              case 4:
                res = _context.sent;

                // fill in what's missing from data (subject, html, text)
                data = (0, _assign2.default)({}, res, data);
                delete data.template;
                delete data.locals;

              case 8:
                this.log('sending email to: ' + data.to, data);
                _context.next = 11;
                return this.constructor.__sendMail(data);

              case 11:
                info = _context.sent;

                this.log('sent email to: ' + data.to, info);

              case 13:
              case 'end':
                return _context.stop();
            }
          }
        }, _callee, this);
      }));

      function perform(_x) {
        return _ref.apply(this, arguments);
      }

      return perform;
    }()
  }], [{
    key: 'mail',
    value: function mail(_mail, opts) {
      this.performLater((0, _assign2.default)({}, this.defaults, _mail));
    }
  }]);
  return Mailer;
}(Worker)) || _class);


var dirToWorkers = function dirToWorkers(dir) {
  var files = fs.readdirSync(dir);
  var modules = L.map(L.filter(files, function (_) {
    return _.match(/\.js$/);
  }), function (_) {
    return require(path.join(dir, _));
  });
  var workers = L.filter(modules, function (_) {
    return _.queueName;
  });
  return workers;
};

// workers: [string|Worker]
// - string   a directory to scan.
// - Worker   a previously required worker.
var discoverWorkers = function discoverWorkers(workers, opts) {
  // join discovered workers from dirs and those
  // that were required explicitly and handed over.
  var dirsAndWorkers = L.groupBy(workers, function (_) {
    return _.queueName ? 'workers' : 'dirs';
  });
  var discoveredWorkers = L.flatMap(dirsAndWorkers['dirs'], dirToWorkers);
  var allWorkers = L.concat(dirsAndWorkers.workers || [], discoveredWorkers || []);
  opts.log('discovered workers:', allWorkers);
  return allWorkers;
};

var init = function init(workers, opts) {
  opts.log = opts.log || console.log;
  opts.queueConfigs = opts.queueConfigs || {};

  // worker
  Worker.__log = opts.log;

  // mailer
  var sendMail = function sendMail() {
    this.log('WARNING: this mailer does nothing. Please set up transport.');
  };
  if (opts.mailTransport) {
    var transport = opts.mailTransport;
    var _Promise = require('bluebird');
    sendMail = _Promise.promisify(transport.sendMail, {
      context: transport
    });
  } else {
    opts.log('Warning: no email transport set.');
  }
  Mailer.__sendMail = sendMail;
  Mailer.templates = opts.mailTemplates || './app/mailers';

  // {
  //    'system':[W1, W2],
  //    'highpriority': [W3]
  // }
  var allWorkers = discoverWorkers(workers, opts);

  var workermap = L.groupBy(allWorkers, function (w) {
    return w.queueName;
  });
  var queues = L.map(workermap, function (ws, queueName) {
    opts.log('Registering: [' + L.map(ws, function (_) {
      return _.name;
    }) + '] on (' + queueName + ')');
    var queue = new Queue(queueName, opts.queueConfigs[queueName] || 'redis://localhost:6379');
    queue.on('error', function (err) {
      opts.log(queueName + ': ERROR', err);
    });
    L.each(ws, function (w) {
      w.queue = queue;
      if (opts.runWorkers) {
        queue.process(w.name, 1, function (data) {
          opts.log(w.tag + ' -- invoking');
          var job = new w();
          job.perform(data);
          opts.log(w.tag + ' -- invoked');
        });
        opts.log(w.tag + ' -- running on this process');
      }
    });
    return queue;
  });

  return queues;
};

module.exports = { Worker: Worker, Mailer: Mailer, queue: queue, init: init };