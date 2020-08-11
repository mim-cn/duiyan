(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('udper', e);
  }
})(this, function (exports) {
  const utils = require('./utils')
  const {
    Messge
  } = require("./message");

  const IDLEN = 5
  const IDMAX = Math.pow(10, IDLEN)

  const getId = () => {
    let id = null
    try {
      var res = wx.getStorageSync('LOCAL')
      if (res) {
        id = res.id
      } else {
        id = utils.randomNum(0, IDMAX)
        wx.setStorage({
          data: {
            id: id
          },
          key: 'LOCAL',
        })
      }
    } catch (e) {
      id = utils.randomNum(0, IDMAX)
      wx.setStorage({
        data: {
          id: id
        },
        key: 'LOCAL',
      })
    }
    id = utils.pad(id, IDLEN)
    return id
  }


  function Udper(port, event) {
    this.bport = port;
    this.seq = utils.getTimestamp()
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
      this.send('255.255.255.255', this.bport, 1, '')
    }
    this.onListening()
    this.offListening()
    this.onMessage()
    this.offMessage()
    this.onClose()
    this.offClose()
  }

  Udper.prototype._create = function (port) {
    try {
      this.udper = wx.createUDPSocket();
      this.udper.bind(port);
    } catch (e) {
      console.error(e)
    }
  }

  /**
   * 向某个ip:port发送消息
   * @param {String} ip 
   * @param {Number} port 
   * @param {Number} mtype 
   * @param {String} data 
   */
  Udper.prototype.send = function (ip, port, mtype, data) {
    return new Promise((resolver, reject) => {
      if (!this.MsgType[mtype]) {
        reject({
          peerIp: ip,
          peerPort: port,
          err: 'INVALID MESSAGE TYPE: ' + mtype
        })
      }
      let msg = new Messge()
      msg.writeNumber(mtype, 1) // 消息类型，1byte
      msg.writeNumber(mtype, 4) // 消息数据包序号 4byte      
      msg.writeNumber(this.id, 2) // 发送端id  2byte
      msg.writeString(data) // 消息内容
      console.log(msg)
      this.udper.send({
        address: ip,
        port: port,
        message: msg.buffer
      })
      resolver({
        peerIp: ip,
        peerPort: port,
        err: 'ok'
      })
    })
  }

  /**
   * 通过id发送消息
   * @param {Number} id 
   * @param {Number} mtype 
   * @param {String} data 
   */
  Udper.prototype.sendById = function (id, mtype, data) {
    let self = this
    return new Promise((resolver, reject) => {
      let info = self.getOthers(id) || []
      if (info && info.length > 0) {
        let ress = []
        info.map(function (each) {
          self.send(each.address, each.port, mtype, data).then(res => {
            ress.push(res)
          }).catch(e => {
            reject(e)
          })
        })
        console.log("sendById resolver:", id, info, ress)
        resolver(ress)
      } else {
        console.log("sendById reject:", id, info)
        reject({
          peerId: id,
          err: 'NOT FOUND ID: ' + id
        })
      }
    })
  }

  Udper.prototype.close = function () {
    // 下线广播
    return this.send('255.255.255.255', this.bport, '0', '-' + this.id)
    // this.upper.close()
  };

  Udper.prototype.onClose = function () {
    return new Promise((resolver) => {
      this.udper.onClose(function (res) {
        console.log("onClose: ", res)
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offClose = function () {
    return new Promise((resolver) => {
      this.udper.offClose(function (res) {
        console.log("offClose: ", res)
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.onError = function () {
    return new Promise((resolver) => {
      this.udper.onError(function (res) {
        console.log("onError: ", res)
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offError = function () {
    return new Promise((resolver) => {
      this.udper.offError(function (res) {
        console.log("offError: ", res)
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.onListening = function () {
    return new Promise((resolver) => {
      this.udper.onListening(function (res) {
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  Udper.prototype.offListening = function () {
    let self = this
    return new Promise((resolver) => {
      this.udper.offListening(function (res) {
        self.onError()
        self.offError()
        resolver({
          message: utils.newAb2Str(res.message),
          LocalInfo: res.remoteInfo,
        })
      })
    })
  }

  /**
   * 添加上线用户
   * @param {Number} id 
   * @param {String} address 
   * @param {Number} port 
   */
  Udper.prototype.addOnline = function (id, address, port) {
    this.online[id] = {
      address: address,
      port: port
    }
    this.online.length++;
    console.log("sync +++: ", this.online[id])
    return this.online[id]
  }

  /**
   * 删除下线用户
   * @param {Number} id 
   */
  Udper.prototype.delOnline = function (id) {
    let out = this.online[id]
    delete this.online[id]
    this.online.length--
    console.log("sync --: ", out)
    return out
  }

  /**
   * 处理设备上下线，各设备之间数据同步的功能
   * @param {*} data 
   */
  Udper.prototype._handleSync = function (data) {
    let method = data.message[0]
    data.message = data.message.slice(1)
    switch (method) {
      case '+':
        this.addOnline(data.message, data.LocalInfo.address, data.LocalInfo.port)
        break;
      case '-':
        this.delOnline(data.message)
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
   * @param {Object} data 
   */
  Udper.prototype._handleLocal = function (data) {
    // 此时message 是当前上线的用户id
    this.addOnline(data.peerId, data.LocalInfo.address, data.LocalInfo.port)
    // 如果是本设备
    if (data.peerId == this.id) {
      data.id = this.id
      this.event.emit("onMessage", data)
    } else {
      // 向新上线的用户推送所有在线
      this.sync(data.peerId, '+' + this.id)
    }
  }

  /**
   * 接受数据时的回调
   */
  Udper.prototype.onMessage = function () {
    let self = this
    self.udper.onMessage(function (res) {
      // console.log("onMessage: ", res)
      let msg = new Messge(res.message)
      let msg_type = msg.readNumber(1) // 消息类型 1byte
      let seqid = msg.readNumber(4) // 消息数据包序号 4byte      
      let peerId = utils.pad(msg.readNumber(2), IDLEN) // 发送方id 2byte
      let message = msg.readString() // 消息内容
      let data = {
        reqid: seqid,
        peerId: peerId,
        message: message,
        LocalInfo: res.remoteInfo,
        iPint: utils.ip2Int(res.remoteInfo.address),
      }
      switch (msg_type) {
        case 0:
          data.type = msg_type
          self._handleSync(data)
          break;
        case 1:
          data.type = msg_type
          self._handleLocal(data)
          break;
        case 2:
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        case 3:
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        case 4:
          data.type = msg_type
          self.event.emit("onMessage", data)
          break;
        case 5:
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
    return new Promise(() => {
      this.udper.offMessage(function () {
        // console.log("offMessage: ", res)
        // resolver({
        //   message: utils.newAb2Str(res.message),
        //   LocalInfo: res.remoteInfo,
        // })
      })
    })
  }

  /**
   * 获取最新的本设备的ip
   */
  Udper.prototype.getLocalip = function () {
    let copy = Object.assign({
      id: this.id
    }, this.online[this.id]);
    return copy
  }

  /**
   * 向某一个设备发送同步类型的数据，主要是同步本设备的数据更新
   * @param {*} id 
   * @param {*} msg 
   */
  Udper.prototype.sync = function (id, msg) {
    return this.sendById(id, '0', msg)
  }

  /**
   * 获取本设备信息
   */
  Udper.prototype.getSelf = function () {
    return this.online[this.id]
  }

  /**
   * 获取除本设备的其他所有设备
   * @param {Number} id 
   */
  Udper.prototype.getOthers = function (id) {
    if (id) {
      return this.online[id] ? [this.online[id]] : null
    }
    let online = []
    let copy = Object.assign({}, this.online);
    for (let prop in copy) {
      if (prop != 'length' /* && prop != this.id*/ ) {
        online.push(copy[prop])
      }
    }
    return online
  }
});