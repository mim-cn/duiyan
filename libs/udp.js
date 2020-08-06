(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('lru', e);
  }
})(this, function (exports) {

  const ps1 = ">"

  const newAb2Str = arrayBuffer => {
    let unit8Arr = new Uint8Array(arrayBuffer);
    let encodedString = String.fromCharCode.apply(null, unit8Arr),
      decodedString = decodeURIComponent(escape((encodedString))); //没有这一步中文会乱码
    return decodedString;
  }

  const randomNum = (lower, upper) => {
    return Math.floor(Math.random() * (upper - lower)) + lower;
  }

  const getTimestamp = () => {
    return new Date().getTime()
  }

  const pad = (num, n) => {
    let str = String(num) || 0;
    return Array(str.length >= n ? 0 : n - str.length + 1).join('0') + str;
  }

  function Udper(port) {
    this.bport = port;
    this.id = getTimestamp() + pad(randomNum(0, 256), 3)
    this.online = {
      t: 0
    }
    this._create(port)
    this.init()
  }

  exports.Udper = Udper;

  Udper.prototype.MsgType = {
    "0": "SYNC",
    "1": "LOCAL",
    "2": "TEXT",
    "3": "FILE",
    "4": "IMAGE",
    "5": "audio",
    "6": "VIDEO",
  }

  Udper.prototype.init = function () {
    this.onClose()
    this.offClose()
    this.onError()
    this.offError()
    this.onListening()
    this.offListening()
    this.offMessage()
  }

  Udper.prototype._create = function (port) {
    this.udper = wx.createUDPSocket();
    this.udper.bind(port);
  }

  Udper.prototype.send = function (ip, port, mtype, data) {
    this.udper.send({
      address: ip,
      port: port,
      message: mtype + this.id + ps1 + data
    })
  }

  Udper.prototype.sendById = function (id, mtype, data) {
    let self = this
    return new Promise((resolver, reject) => {
      let info = self.getOthers(id)
      if (info) {
        this.udper.send({
          address: info.address,
          port: info.port,
          message: mtype + self.id + ps1 + data
        })
        resolver({
          peerId: id,
          peerIp: info.address,
          err: 'ok'
        })
      }
      reject({
        peerId: id,
        err: 'fail'
      })
    })
  }

  Udper.prototype.sendByIp = function (ip, mtype, data) {
    let self = this
    return new Promise((resolver, reject) => {
      this.udper.send({
        address: ip,
        port: self.port,
        message: mtype + self.id + ps1 + data
      })
      resolver({
        peerId: null,
        peerIp: ip,
        err: 'ok'
      })
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
    let self = this
    return new Promise((resolver, reject) => {
      self.udper.onMessage(function (res) {
        console.log("onMessage: ", res)
        let res_msg = newAb2Str(res.message)
        let msg_type = res_msg[0]
        let data = {
          message: res_msg.slice(1),
          LocalInfo: res.remoteInfo,
          type: msg_type
        }
        switch (msg_type) {
          case '0':
            break;
          case '1':
            data.message = data.message.slice(0, -1)
            self.online[data.message] = data.LocalInfo
            // data.cur = self.online['t']++
            break;
          case '2':
            break;
          case '3':
            break;
          case '4':
            break;
          case '5':
            break;
          default:
            break;
        }
        console.log("online", self.online)
        resolver(data)
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
      this.send('255.255.255.255', this.bport, '1', '')
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

  Udper.prototype.getSelf = function () {
    return this.online[this.id]
  }

  Udper.prototype.getOthers = function (id) {
    if (id) {
      return this.online[id]
    }
    let copy = Object.assign({}, this.online);
    delete copy[this.id]
    return copy
  }
});