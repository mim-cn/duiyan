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

  const getInitSeqNumber = () => {
    return parseInt(utils.getTimestamp() / utils.randomNum(0, IDMAX))
  }

  class BaseUdper {
    constructor(port, event) {
      this.bport = port;
      this.event = event;
      this.id = this.getId();
      this._create(port);
    }
    init() {
      this.onListening();
      this.offListening();
      this.onMessage();
      this.offMessage();
      this.onClose();
      this.offClose();
    }
    _create(port) {
      try {
        this.udper = wx.createUDPSocket();
        this.udper.bind(port);
      } catch (e) {
        console.error(e);
      }
    }
    getId() {
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
    onClose() {
      return new Promise((resolver) => {
        this.udper.onClose(function (res) {
          console.log("onClose: ", res);
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    offClose() {
      return new Promise((resolver) => {
        this.udper.offClose(function (res) {
          console.log("offClose: ", res);
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    onError() {
      return new Promise((resolver) => {
        this.udper.onError(function (res) {
          console.log("onError: ", res);
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    offError() {
      return new Promise((resolver) => {
        this.udper.offError(function (res) {
          console.log("offError: ", res);
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    onListening() {
      return new Promise((resolver) => {
        this.udper.onListening(function (res) {
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    offListening() {
      let self = this;
      return new Promise((resolver) => {
        this.udper.offListening(function (res) {
          self.onError();
          self.offError();
          resolver({
            message: utils.newAb2Str(res.message),
            LocalInfo: res.remoteInfo,
          });
        });
      });
    }
    offMessage() {
      return new Promise(() => {
        this.udper.offMessage(function () {
          // console.log("offMessage: ", res)
          // resolver({
          //   message: utils.newAb2Str(res.message),
          //   LocalInfo: res.remoteInfo,
          // })
        });
      });
    }

    /**
     * 接受数据时的回调
     */
    onMessage() {
      let self = this;
      self.udper.onMessage(function (res) {
        if (self._handleOnMessage) {
          self._handleOnMessage(res)
        }
      });
    }
  }

  class Udper extends BaseUdper {
    constructor(port, event) {
      super(port, event)
      this.isn = getInitSeqNumber();
      this.online = {
        length: 0
      };
      this.init()
    }

    init() {
      let self = this
      // if (!self.getSelf()) {
      //   this.connect(data)
      // }
      super.init()
      wx.onNetworkStatusChange(function (res) {
        self.close()
        wx.showToast({
          title: '网络有点小问题',
          icon: 'loading'
        });
        self.getLocalip(true)
        setTimeout(function () {
          wx.hideToast({
            complete: (res) => {},
          })
        }, 1000)
      })
    }

    set_header(mtype) {
      let msg = new Messge();
      msg.writeNumber(mtype, 1); // 消息类型，1byte
      msg.writeNumber(this.isn++, 4); // 消息数据包序号 4byte      
      msg.writeNumber(this.id, 2); // 发送端id  2byte
      return msg;
    }
    get_header(data) {
      let msg = new Messge(data);
      return {
        msg: msg,
        mtype: msg.readNumber(1),
        seq: msg.readNumber(4),
        peerId: utils.pad(msg.readNumber(2), IDLEN),
      };

    }
    /**
     * 向某个ip:port发送消息
     * @param {String} ip
     * @param {Number} port
     * @param {Number} mtype
     * @param {String} data
     */
    send(ip, port, mtype, data) {
      let self = this;
      return new Promise((resolver, reject) => {
        if (!this.MsgType[mtype]) {
          reject({
            peerIp: ip,
            peerPort: port,
            err: 'INVALID MESSAGE TYPE: ' + mtype
          });
        }
        let msg = self.set_header(mtype);
        msg.writeString(data); // 消息内容
        console.log(msg);
        this.udper.send({
          address: ip,
          port: port,
          message: msg.buffer
        });
        resolver({
          peerIp: ip,
          peerPort: port,
          err: 'ok'
        });
      });
    }
    /**
     * 通过id发送消息
     * @param {Number} id
     * @param {Number} mtype
     * @param {String} data
     */
    sendById(id, mtype, data) {
      let self = this;
      return new Promise((resolver, reject) => {
        let info = self.getOthers(id) || [];
        if (info && info.length > 0) {
          let ress = [];
          info.map(function (each) {
            self.send(each.address, each.port, mtype, data).then(res => {
              ress.push(res);
            }).catch(e => {
              reject(e);
            });
          });
          console.log("sendById resolver:", id, info, ress);
          resolver(ress);
        } else {
          console.log("sendById reject:", id, info);
          reject({
            peerId: id,
            err: 'NOT FOUND ID: ' + id
          });
        }
      });
    }
    connect() {
      this.send('255.255.255.255', this.bport, 1, '');
    }
    close() {
      // 下线广播
      if (this.online[this.id]) {
        return this.send('255.255.255.255', this.bport, '0', '-' + this.id);
        // this.upper.close()
      }
    }
    /**
     * 添加上线用户
     * @param {Number} id
     * @param {String} address
     * @param {Number} port
     */
    addOnline(id, address, port) {
      let one = this.online[id];
      if (!one) {
        this.online.length++;
      }
      this.online[id] = {
        address: address,
        port: port
      };
      console.log("sync +++: ", this.online[id]);
      return this.online[id];
    }
    /**
     * 删除下线用户
     * @param {Number} id
     */
    delOnline(id) {
      let one = this.online[id];
      if (one) {
        delete this.online[id];
        this.online.length--;
        console.log("sync --: ", one);
      }
      return one;
    }
    /**
     * 处理设备上下线，各设备之间数据同步的功能
     * @param {*} data
     */
    _handleSync(data) {
      data.message = data.message + ''
      let method = data.message[0];
      let one = null
      data.message = data.message.slice(1);
      switch (method) {
        case '+':
          one = this.addOnline(data.message, data.LocalInfo.address, data.LocalInfo.port);
          break;
        case '-':
          one = this.delOnline(data.message);
          break;
        default:
          break;
      }
      data.online = this.online.length;
      if (one) {
        this.event.emit("onMessage", data);
      }
      return data;
    }
    /**
     * 处理设备ip地址获取的功能
     * @param {Object} data
     */
    _handleLocal(data) {
      // 此时message 是当前上线的用户id
      this.addOnline(data.peerId, data.LocalInfo.address, data.LocalInfo.port);
      // 如果是本设备
      if (data.peerId == this.id) {
        data.id = this.id;
        this.event.emit("onMessage", data);
      } else {
        // 向新上线的用户推送所有在线
        this.sync(data.peerId, '+' + this.id);
      }
    }
    // 
    _handleOnMessage(res) {
      // console.log("onMessage: ", res)
      let {
        msg,
        mtype,
        seq,
        peerId
      } = this.get_header(res.message);
      let message = msg.readString(); // 消息内容
      let data = {
        seq: seq,
        peerId: peerId,
        message: message,
        LocalInfo: res.remoteInfo,
        iPint: utils.ip2Int(res.remoteInfo.address),
      };
      switch (mtype) {
        case 0:
          data.type = mtype;
          this._handleSync(data);
          break;
        case 1:
          data.type = mtype;
          this._handleLocal(data);
          break;
        case 2:
        case 3:
        case 4:
        case 5:
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
        default:
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
      }
      console.info("online", this.online);
      console.info("current", this);
    }
    /**
     * 获取最新的本设备的ip
     */
    getLocalip(forse) {
      if (!forse && this.online[this.id]) {
        let copy = Object.assign({
          id: this.id
        }, this.online[this.id]);
        return copy;
      } else {
        this.connect()
      }
    }
    /**
     * 向某一个设备发送同步类型的数据，主要是同步本设备的数据更新
     * @param {*} id
     * @param {*} msg
     */
    sync(id, msg) {
      return this.sendById(id, '0', msg);
    }
    /**
     * 获取本设备信息
     */
    getSelf() {
      return this.online[this.id];
    }
    /**
     * 获取除本设备的其他所有设备
     * @param {Number} id
     */
    getOthers(id) {
      if (id) {
        return this.online[id] ? [this.online[id]] : null;
      }
      let online = [];
      let copy = Object.assign({}, this.online);
      for (let prop in copy) {
        if (prop != 'length' /* && prop != this.id*/ ) {
          online.push(copy[prop]);
        }
      }
      return online;
    }
  }


  exports.Udper = Udper;

  BaseUdper.prototype.MsgType = {
    "0": "SYNC",
    "1": "LOCAL",
    "2": "TEXT",
    "3": "FILE",
    "4": "IMAGE",
    "5": "AUDIO",
    "6": "VIDEO",
  }


















});