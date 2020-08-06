import {
  randomNum,
  newAb2Str
} from '../utils/util.js'

(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('lru', e);
  }
})(this, function (exports) {

  const ps1 = ">"

  function Udper(port) {
    this.bport = port;
    this.id = randomNum(9999, 99999)
    this.create(port)
    this.init()
  }

  exports.Udper = Udper;

  Udper.prototype.init = function () {
    this.onClose()
    this.offClose()
    this.onError()
    this.offError()
    this.onListening()
    this.offListening()
    this.offMessage()
  }

  Udper.prototype.create = function (port) {
    this.udper = wx.createUDPSocket();
    this.udper.bind(port);
  }

  Udper.prototype.send = function (ip, port, data) {
    this.udper.send({
      address: ip,
      port: port,
      message: this.id + ps1 + data
    })
  }

  Udper.prototype.close = function () {
    this.udper.close()
  };

  Udper.prototype.onClose = function () {
    return new Promise((resolver, reject) => {
      this.udper.onClose(function (res) {
        console.log("onClose: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offClose = function () {
    return new Promise((resolver, reject) => {
      this.udper.offClose(function (res) {
        console.log("offClose: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.onError = function () {
    return new Promise((resolver, reject) => {
      this.udper.onError(function (res) {
        console.log("onError: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offError = function () {
    return new Promise((resolver, reject) => {
      this.udper.offError(function (res) {
        console.log("offError: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.onListening = function () {
    return new Promise((resolver, reject) => {
      this.udper.onListening(function (res) {
        console.log("onListening: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offListening = function () {
    return new Promise((resolver, reject) => {
      this.udper.offListening(function (res) {
        console.log("offListening: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.onMessage = function () {
    return new Promise((resolver, reject) => {
      this.udper.onMessage(function (res) {
        console.log("onMessage: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offMessage = function () {
    return new Promise((resolver, reject) => {
      this.udper.offMessage(function (res) {
        console.log("offMessage: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.getLocalip = function () {
    let self = this
    return new Promise((resolver, reject) => {
      this.send('255.255.255.255', this.bport, '')
      // 广播接收者
      this.onMessage().then(res => {
        let _id = parseInt(res.message)
        if (self.id == _id) {
          res.id = _id
          resolver(res)
        } else {
          console.log("error", res_message)
          reject(res)
        }
      }).catch(e => {})
    })
  }
});