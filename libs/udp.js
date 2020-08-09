(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('udper', e);
  }
})(this, function (exports) {

  const ps1 = ">"
  const IDLEN = 4
  const regexIP = /\b((25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\b/;
  /**
   * Parses IPv4 to Integer
   * @param  {String}   ip  [valid IPv4 string]
   * @return {Integer}      [Integer value of IPv4 provided]
   */
  const toInt = (ip) => {
    if (!ip) {
      throw new Error('E_UNDEFINED_IP');
    }

    if (!regexIP.test(ip)) {
      throw new Error('E_INVALID_IP');
    }

    /*
      String value 189.170.79.173
      Integer	3182055341
      To convert an IP address to integer, break it into four octets.
      For example, the ip address you provided can be broken into
      First Octet:	189
      Second Octet:	170
      Third Octet:	79
      Fourth Octet:	173
      To calculate the decimal address from a dotted string, perform the following calculation.
      = (first octet * 256³) + (second octet * 256²) + (third octet * 256) + (fourth octet)
      =	(first octet * 16777216) + (second octet * 65536) + (third octet * 256) + (fourth octet)
      =	(189 * 16777216) + (170 * 65536) + (79 * 256) + (173)
      =	3182055341
      Reference http://www.aboutmyip.com/AboutMyXApp/IP2Integer.jsp
    */
    return ip.split('.').map((octet, index, array) => {
      return parseInt(octet) * Math.pow(256, (array.length - index - 1));
    }).reduce((prev, curr) => {
      return prev + curr;
    });
  }

  /**
   * Parses Integer to IPv4
   *
   * @param  {String} value [value to parse]
   * @return {String}       [IPv4 String of value provided]
   */
  const toIp = (value) => {
    if (!value) {
      throw new Error('E_UNDEFINED_INTEGER');
    }
    const result = /\d+/.exec(value);
    if (!result) {
      throw new Error('E_INTEGER_NOT_FOUND');
    }
    value = result[0];
    return [
      (value >> 24) & 0xff,
      (value >> 16) & 0xff,
      (value >> 8) & 0xff,
      value & 0xff
    ].join('.');
  }

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

  const getId = () => {
    let id = null
    try {
      var res = wx.getStorageSync('LOCAL')
      if (res) {
        id = res.id
      } else {
        id = pad(randomNum(0, 5001), IDLEN)
        wx.setStorage({
          data: {
            id: id
          },
          key: 'LOCAL',
        })
      }
    } catch (e) {
      id = pad(randomNum(0, 5001), IDLEN)
      wx.setStorage({
        data: {
          id: id
        },
        key: 'LOCAL',
      })
    }
    return id
  }

  function Udper(port, event) {
    this.bport = port;
    this.seq = getTimestamp()
    this.id = getId()
    this.event = event
    this.online = {
      length: 0
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
    "5": "AUDIO",
    "6": "VIDEO",
  }

  Udper.prototype.init = function () {
    if (!this.getSelf()) {
      this.send('255.255.255.255', this.bport, '1', '')
    }
    this.onClose()
    this.offClose()
    this.onError()
    this.offError()
    this.onListening()
    this.offListening()
    this.onMessage()
    this.offMessage()
  }

  Udper.prototype._create = function (port) {
    try {
      this.udper = wx.createUDPSocket();
      this.udper.bind(port);
    } catch (e) {
      console.error(e)
    }
  }

  Udper.prototype.send = function (ip, port, mtype, data) {
    if (!this.MsgType[mtype]) {
      throw new Error("invalid message type: " + mtype)
    }
    this.udper.send({
      address: ip,
      port: port,
      message: mtype + this.id + ps1 + data
    })
  }

  Udper.prototype.sendById = function (id, mtype, data) {
    let self = this
    return new Promise((resolver, reject) => {
      let info = self.getOthers(id) || []
      if (info) {
        info.map(function (each, index, array) {
          self.send(each.address, each.port, mtype, data)
        })
        console.log("sendById resolver:", id, info)
        resolver({
          peerId: id,
          peerIp: info.address,
          err: 'ok'
        })
      } else {
        console.log("sendById reject:", id, info)
        reject({
          peerId: id,
          err: 'fail'
        })
      }
    })
  }

  Udper.prototype.sendByIp = function (ip, mtype, data) {
    let self = this
    return new Promise((resolver, reject) => {
      self.send(ip, self.bport, mtype, data)
      resolver({
        peerId: null,
        peerIp: ip,
        err: 'ok'
      })
    })
  }

  Udper.prototype.close = function () {
    // 下线广播
    this.send('255.255.255.255', this.bport, '0', '-' + this.id)
    this.upper.close()
  };

  Udper.prototype.onClose = function () {
    console.log("onClose:")
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
    console.log("offClose:")
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
    console.log("onError:")
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
    console.log("offError:")
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
    console.log("onListening:")
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
    console.log("offListening:")
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

  /**
   * 处理设备上下线，各设备之间数据同步的功能
   * @param {*} data 
   */
  Udper.prototype._handleSync = function (data) {
    // 接受同步的所有在线用户
    let method = data.message[0]
    data.message = data.message.slice(1)
    switch (method) {
      case '+':
        this.online[data.message] = data.LocalInfo
        this.online.length++
        console.log("sync +++: ", data)
        break;
      case '-':
        delete this.online[data.message]
        this.online.length--
        console.log("sync --: ", data)
        break;
      default:
        break;
    }
    data.online = this.online.length
    this.event.emit("onMessage", data)
    return data
  }

  /**
   * 处理设备ip地址获取的功能
   * @param {*} data 
   */
  Udper.prototype._handleLocal = function (data) {
    // 此时message 是当前上线的用户id
    this.online[data.peerId] = data.LocalInfo
    this.online.length++
    // 如果是本设备
    if (data.peerId == this.id) {
      data.id = this.id
      this.event.emit("onMessage", data)
    } else {
      // 向新上线的用户推送所有在线
      this.sync(data.peerId, '+' + this.id)
    }
  }

  Udper.prototype.onMessage = function () {
    let self = this
    self.udper.onMessage(function (res) {
      console.log("onMessage: ", res)
      let res_msg = newAb2Str(res.message)
      let msg_type = res_msg[0]
      let peerId = res_msg.slice(1, ps1.length + IDLEN)
      let message = res_msg.slice(ps1.length + IDLEN + 1)
      let data = {
        reqid: getTimestamp() + randomNum(0, 10000),
        peerId: peerId,
        message: message,
        LocalInfo: res.remoteInfo,
        iPint: toInt(res.remoteInfo.address),
      }
      switch (msg_type) {
        case '0':
          data.type = msg_type
          self._handleSync(data)
          break;
        case '1':
          data.type = msg_type
          self._handleLocal(data)
          break;
        case '2':
          data.type = msg_type
          // 接受同步的所有在线用户
          self.event.emit("onMessage", data)
          break;
        case '3':
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        case '4':
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        case '5':
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        default:
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
      }
      console.info("online", self.online)
      console.info("current", self)
    })
  }

  Udper.prototype.offMessage = function () {
    console.log("offMessage:")
    return new Promise((resolver, reject) => {
      this.udper.offMessage(function (res) {
        // console.log("offMessage: ", res)
        resolver({
          message: newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.getLocalip = function () {
    let copy = Object.assign({
      id: this.id
    }, this.online[this.id]);
    return copy
  }

  Udper.prototype.sync = function (id, msg) {
    return this.sendById(id, '0', msg)
  }

  Udper.prototype.getSelf = function () {
    return this.online[this.id]
  }

  Udper.prototype.getOthers = function (id) {
    if (id) {
      return [this.online[id]]
    }
    let online = []
    let copy = Object.assign({}, this.online);
    for (let prop in copy) {
      if (prop != 'length' && prop != this.id) {
        online.push(copy[prop])
      }
    }
    return online
  }
});