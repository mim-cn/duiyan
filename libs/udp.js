/**
 * header：
 * 
 *   1 byte 0:
 *     0[0000 0000b]: "SYNCS"  同步局域网内状态   128[1000 0000b]: "A_SYNCS"  确认同步
 *     1[0000 0001b]: "LOCAL"  定位本设备ip信息   129[0000 0001b]: "A_LOCAL"  确认定位
 *     2[0000 0010b]: "BEGIN"  首次开始数据传输   130[1000 0010b]: "A_BEGIN"  确认开始
 *     3[0000 0011b]: "DOING"  中间数据传输过程   131[1000 0011b]: "A_DOING"  确认数据
 *     4[0000 0100b]: "DONED"  结束数据传输过程   132[1000 0100b]: "A_DONED"  确认结束
 *   4 byte 1 ~ 4:
 *     sequence
 *   2 byte 5 ~ 6:
 *     send peer id
 *   n byte 7 ~  wan MAX: 548-7 = 541 ~= 520 ; lan MAX: 1472-7 = 1465 ~= 1444
 *     
 * 
 * version 1.0:
 * 
 *   分段确认: 要么一次数据包全部收到，要么全部丢失
 *     +++++++         seq x, data       +++++++
 *     |  A  |        ------------>      |  B  |
 *     +++++++        <------------      +++++++
 *                        ack x
 * 
 */
(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('udper', e);
  }
})(this, function (exports) {
  const utils = require('./utils')
  const event = require('./event.js')
  const {
    Messge
  } = require("./message");

  const IDLEN = 5
  const IDMAX = Math.pow(10, IDLEN)

  const getInitSeqNumber = () => {
    return parseInt(utils.getTimestamp() / utils.randomNum(0, IDMAX))
  }

  /**
   * let bool = true;
   * let num = 1;
   * let str = 'abc';
   * let und = undefined;
   * let nul = null;
   * let arr = [1,2,3,4];
   * let obj = {name:'xiaoming',age:22};
   * let fun = function(){console.log('hello')};
   * let s1 = Symbol();
   * Object.prototype.toString.call(bool);//[object Boolean]
   * Object.prototype.toString.call(num); //[object Number]
   * Object.prototype.toString.call(str); //[object String]
   * Object.prototype.toString.call(und); //[object Undefined]
   * Object.prototype.toString.call(nul); //[object Null]
   * Object.prototype.toString.call(arr); //[object Array]
   * Object.prototype.toString.call(obj); //[object Object]
   * Object.prototype.toString.call(fun); //[object Function]
   * Object.prototype.toString.call(s1);  //[object Symbol]
   */
  const Type = (obj) => {
    return Object.prototype.toString.call(obj).slice(8, -1)
  }

  // 基于wx.UDPSocket的基础类
  class BaseUdper {
    constructor(port) {
      // 用于udp通信时的事件通知
      this.$e = event
      // udp通信绑定的port，默认5328
      this.bport = port;
      // 获取随机分配的设备id，用于唯一标识
      this.id = this.getId();
      this.create(port);
    }
    // 错误处理
    error(msg) {
      throw new Error(msg);
    }
    // 初始化udp相关回调
    init() {
      this.onListening();
      this.offListening();
      this.onMessage();
      this.offMessage();
      this.onClose();
      this.offClose();
    }
    create(port) {
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
            IPinfo: res.remoteInfo,
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
            IPinfo: res.remoteInfo,
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
            IPinfo: res.remoteInfo,
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
            IPinfo: res.remoteInfo,
          });
        });
      });
    }
    onListening() {
      return new Promise((resolver) => {
        this.udper.onListening(function (res) {
          resolver({
            message: utils.newAb2Str(res.message),
            IPinfo: res.remoteInfo,
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
            IPinfo: res.remoteInfo,
          });
        });
      });
    }
    offMessage() {
      return new Promise(() => {
        this.udper.offMessage(function () { });
      });
    }
    // serialize the data
    serialize(data) {
      let type = Type(data);
      switch (type) {
        case "Number":
          return data;
        case "String":
          return data;
        case "Array":
        case "Object":
          return JSON.stringify(data)
        case "Boolean":
          return (data === true) ? 1 : 0;
        case "Undefined":
        case "Null":
          return '';
        default:
          return '';
      }
    }
    // unserialize the data
    unserialize(data) {
      return JSON.parse(data)
    }
    // 设置特殊类型消息的header
    set_header(mtype) {
      let msg = new Messge();
      msg.writeNumber(mtype, 1); // 消息类型，1byte
      msg.writeNumber(this.isn++, 4); // 消息数据包序号 4byte      
      msg.writeNumber(this.id, 2); // 发送端id  2byte
      return msg;
    }
    // 从获取的数据解析header，与set_header对应
    get_header(data) {
      let msg = new Messge(data);
      return {
        msg: msg,
        mtype: msg.readNumber(1),
        seq: msg.readNumber(4),
        peerId: utils.pad(msg.readNumber(2), IDLEN),
      };
    }
    // 接受数据时的回调
    onMessage() {
      let self = this;
      self.udper.onMessage(function (res) {
        let { msg, mtype, seq, peerId } = self.get_header(res.message);
        let data = msg.readString(); // 消息内容
        let peerInfo = res.remoteInfo || {}
        peerInfo.peerId = peerId
        if (mtype < self.rMsgType["A_SYNCS"]) {
          self._handleOnMessage(mtype, seq, peerInfo, data)
        } else {
          self._handleAckMessage(mtype, seq, peerInfo, data)
        }
      });
    }
    // 向某个ip:port发送类型mtype的消息data
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
        data = this.serialize(data)
        // 数据包大小处理
        if (data && (data.length > self.WAN_PACK_SIZE || data.length > self.LAN_PACK_SIZE)) {
          reject({
            peerIp: ip,
            peerPort: port,
            err: 'Request Entity Too Large!'
          });
        } else {
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
        }
      });
    }
    // 通过id发送mtype消息的数据data
    sendById(id, mtype, data) {
      let self = this;
      let info = self.getOthers(id) || [];
      return Promise.all(info.map((item) => {
        return self.send(item.address, item.port, mtype, data);
      }));
    }
  }

  // 实现可靠的udp封装类
  class Udper extends BaseUdper {
    constructor(port, event) {
      super(port)
      // 用于与业务层的事件通知，将通知上报到业务层
      this.event = event;
      this.isn = getInitSeqNumber();
      this.online = {
        length: 0
      };
      this.init()
    }

    // 基础网络方法

    // 初始化各类回调
    init() {
      let self = this
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
            complete: (res) => { },
          })
        }, 1000)
      })
    }
    // 发送上线广播通知
    connect() {
      return this.send('255.255.255.255', this.bport, 1, '');
    }
    // 下线广播
    close() {
      if (this.online[this.id]) {
        return this.send('255.255.255.255', this.bport, '0', '-' + this.id);
        // this.upper.close()
      }
    }
    // 向某一个设备id发送同步类型的数据，主要是同步本设备的数据更新
    sync(id, msg) {
      return this.sendById(id, '0', msg);
    }

    // 消息处理方法

    // 处理[SYNC数据包]设备上下线，各设备之间数据同步的功能
    _handleSync(data) {
      data.message = data.message + ''
      let method = data.message[0];
      let one = null
      data.message = data.message.slice(1);
      switch (method) {
        case '+':
          one = this.addOnline(data.message, data.IPinfo.address, data.IPinfo.port);
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
    // 处理[LOCAL数据包]设备ip地址获取的功能
    _handleLocal(data) {
      // 此时message 是当前上线的用户id
      let one = this.addOnline(data.peerId, data.IPinfo.address, data.IPinfo.port);
      // 如果是本设备
      if (data.peerId == this.id) {
        one.id = this.id;
        this.$e.once("localip", one);
        data.id = this.id;
        this.event.emit("onMessage", data);
      } else {
        // 向新上线的用户推送所有在线
        this.sync(data.peerId, '+' + this.id);
      }
    }
    // 处理来自网络的确认包
    _handleAckMessage(mtype, seq, peerInfo, message) {
      // console.log("onMessage: ", res)
      let data = {
        seq: seq,
        message: message,
        IPinfo: peerInfo,
        peerId: peerInfo.peerId,
        iPint: utils.ip2Int(peerInfo.address),
      };
      switch (mtype) {
        case 128:
          data.type = mtype;
          this._handleSync(data);
          break;
        case 129:
          data.type = mtype;
          this._handleLocal(data);
          break;
        case 130:
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
        case 131:
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
        case 132:
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
    // 处理来自网络的数据包
    _handleOnMessage(mtype, seq, peerInfo, message) {
      // console.log("onMessage: ", res)
      let data = {
        seq: seq,
        message: message,
        IPinfo: peerInfo,
        peerId: peerInfo.peerId,
        iPint: utils.ip2Int(peerInfo.address),
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
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
        case 3:
          data.type = mtype;
          this.event.emit("onMessage", data);
          break;
        case 4:
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

    // 工具方法

    // 获取最新的本设备的ip， 默认从缓存获取，否则再次发送广播获取
    getLocalip(forse) {
      return new Promise((resolver, reject) => {
        if (!forse) {
          if (this.online[this.id]) {
            let copy = Object.assign({
              id: this.id
            }, this.online[this.id]);
            resolver(copy);
          } else {
            reject(e)
          }
        } else {
          this.connect().then(_ => {
            this.$e.on("localip", this, resolver)
          }).catch(e => {
            reject(e)
          })
        }
      });
    }
    // 获取本设备信息， 从缓存获取
    getSelf() {
      return this.online[this.id];
    }
    // 获取除本设备的其他所有设备, 如果id存在，即获取对应的信息
    getOthers(id) {
      if (id) {
        return this.online[id] ? [this.online[id]] : null;
      }
      let online = [];
      let copy = Object.assign({}, this.online);
      for (let prop in copy) {
        if (prop != 'length' /* && prop != this.id*/) {
          online.push(copy[prop]);
        }
      }
      return online;
    }
    // 添加上线用户id address port
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
    // 删除下线用户id
    delOnline(id) {
      let one = this.online[id];
      if (one) {
        delete this.online[id];
        this.online.length--;
        console.log("sync --: ", one);
      }
      return one;
    }
  }


  exports.Udper = Udper;

  // 局域网最大数据包大小
  BaseUdper.prototype.LAN_PACK_SIZE = 1444
  // 广域网最大数据包大小
  BaseUdper.prototype.WAN_PACK_SIZE = 520
  // 数据包消息类型
  BaseUdper.prototype.MsgType = {
    "0": "SYNCS",
    "1": "LOCAL",
    "2": "BEGIN",
    "3": "DOING",
    "4": "DONED",
    "128": "A_SYNCS",
    "129": "A_LOCAL",
    "130": "A_BEGIN",
    "131": "A_DOING",
    "132": "A_DONED",
  }
  // 数据包反消息类型
  BaseUdper.prototype.rMsgType = {
    "SYNCS": 0,
    "LOCAL": 1,
    "BEGIN": 2,
    "DOING": 3,
    "DONED": 4,
    "A_SYNCS": 128,
    "A_LOCAL": 129,
    "A_BEGIN": 130,
    "A_DOING": 131,
    "A_DONED": 132,
  }
});