/**
 * header：
 * 
 *   1 byte 0:
 *     0[0000 0000b]: "SYNCS"  同步局域网内状态  <=>  128[1000 0000b]: "A_SYNCS"  确认同步
 *     1[0000 0001b]: "LOCAL"  定位本设备的信息  <=>  129[1000 0001b]: "A_LOCAL"  确认定位
 *     2[0000 0010b]: "BEGIN"  首次开始数据传输  <=>  130[1000 0010b]: "A_BEGIN"  确认开始
 *     4[0000 0100b]: "DOING"  中间数据传输过程  <=>  132[1000 0100b]: "A_DOING"  确认数据
 *     8[0000 1000b]: "DONED"  结束数据传输过程  <=>  136[1000 1000b]: "A_DONED"  确认结束
 *     NOTE:
 *         1. 业务层需要按照数据的发送状态设置合理的数据包标志，但是如果没有按照合法的设置，存在一定风险，导致数据控制紊乱。
 *         2. 首个数据包、中间数据包、结束数据包允许同时存在（允许也建议 FBDD），可以拆分成 FB00 + F0DD 或 FB00 + F0D0 + F00D
 *         3. 首个数据包不能与中间数据包单独同时存在（禁止 FBD0）
 *   4 byte 1 ~ 4:
 *     sequence
 *   2 byte 5 ~ 6:
 *     send peer id
 *   2 byte 7 ~ 8:
 *     crc16 checksum
 *   n byte 9 ~  wan MAX: 548-7 = 541 ~= 512 ; lan MAX: 1472-7 = 1465 ~= 1024
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
  const utils = require('../common/utils')
  const _event = require('../common/event.js')
  const {
    Messge
  } = require("./message");

  const IDLEN = 5
  const IDMAX = Math.pow(10, IDLEN)
  const RIGHT_MOVE = 11
  const ISN_INTERVAL = 1 << RIGHT_MOVE  // 2048

  // 重传机制超时时间
  const ACK_TIMEOUT = 400
  // 局域网最大数据包大小
  const LAN_PACK_SIZE = 1024
  // 广域网最大数据包大小
  const WAN_PACK_SIZE = 512
  // 重试次数
  const RETRY = 100
  // 数据包反消息类型
  const rMsgType = {
    "SYNCS": 0,
    "LOCAL": 1,
    "BEGIN": 2,
    "DOING": 4,
    "DONED": 8,
    "DOING|DONED": 12, // 4 | 8,
    "BEGIN|DOING|DONED": 14, // 2 | 4 | 8,
    "A_SYNCS": 128,
    "A_LOCAL": 129,
    "A_BEGIN": 130,
    "A_DOING": 132,
    "A_DONED": 136,
    "A_DOING|A_DONED": 140, // 132 | 136,
    "A_BEGIN|A_DOING|A_DONED": 142, // 130 | 132 | 136,
  }



  // 标志位
  // 同步数据包
  const FSYNC = rMsgType['SYNCS']
  // 定位数据包
  const FLOCAL = rMsgType['LOCAL']
  // 首个数据包
  const FB00 = rMsgType['BEGIN']
  // 大型数据包中间数据包
  const F0D0 = rMsgType['DOING']
  // 结束数据包
  const F00D = rMsgType['DONED']
  // 既是中间数据包又是结束数据包， 即rMsgType['DOING'] | rMsgType['DONED']
  const F0DD = rMsgType['DOING|DONED']
  // 对于小型数据, 首个数据包既是中间数据包又是最后一个数据包，即rMsgType['BEGIN'] | rMsgType['DOING'] | rMsgType['DONED']
  const FBDD = rMsgType['BEGIN|DOING|DONED']

  // 确认标志位
  // 确认同步数据包
  const A_SYNC = rMsgType['A_SYNCS']
  // 确认定位数据包
  const A_LOCAL = rMsgType['A_LOCAL']
  // 确认首个数据包
  const A_B00 = rMsgType['A_BEGIN']
  // 确认大型数据包中间数据包
  const A_0D0 = rMsgType['A_DOING']
  // 确认结束数据包
  const A_00D = rMsgType['A_DONED']
  // 确认既是中间数据包又是结束数据包，即 rMsgType['A_DOING'] | rMsgType['A_DONED']
  const A_0DD = rMsgType['A_DOING|A_DONED']
  // 确认对于小型数据, 首个数据包既是中间数据包又是最后一个数据包，即rMsgType['A_BEGIN'] | rMsgType['A_DOING'] | rMsgType['A_DONED']
  const A_BDD = rMsgType['A_BEGIN|A_DOING|A_DONED']

  // 数据包消息类型
  const MsgType = {
    // 发送数据包类型
    [FSYNC]: "SYNCS",
    [FLOCAL]: "LOCAL",
    [FB00]: "BEGIN",
    [F0D0]: "DOING",
    [F00D]: "DONED",
    [F0DD]: "DOING|DONED",
    [FBDD]: "BEGIN|DOING|DONED",
    // 确认数据包类型
    [A_SYNC]: "A_SYNCS",
    [A_LOCAL]: "A_LOCAL",
    [A_B00]: "A_BEGIN",
    [A_0D0]: "A_DOING",
    [A_00D]: "A_DONED",
    [A_0DD]: "A_DOING|A_DONED",
    [A_BDD]: "A_BEGIN|A_DOING|A_DONED"
  }

  const getInitSeqNumber = (x) => {
    let startISN = function (x) {
      return Math.floor(x >>> RIGHT_MOVE);
    }(x || 0)
    // 保证每次生成的数字间隔最小 ISN_INTERVAL
    startISN = (startISN + 1) * ISN_INTERVAL;
    return parseInt(utils.RandomNum(startISN, (-1 >>> 32)))
  }

  /**
   * 1. 一段时间内UDP传输过程中的seq资源的分配、消费管理；
   * 2. 一段时间内UDP传输过程中的数据包状态管理
   *     - 数据包控制位的设置与解析
   *     - 数据包数据传输状态的管理
   */
  class Packer {
    constructor() {
      /**
       * 表示已使用的isn的起始位，同时意味着该数字后2048个位置，被一定时间占用
       * eg: 
       *     isn = 152122
       *     则下一个数据包的isn
       *     必须从 152122 + 2048 = 154170开始分配
       */
      this.data = {}
    }

    // 一个新的数据包发送，申请一个新的isn
    malloc(size) {
      this.isn = getInitSeqNumber(this.isn);
      this.data[this.isn] = {};
      size = size || 2048;
      // 待确认的seq
      this.data[this.isn]['ack'] = [this.isn];
      // seq区段大小
      this.data[this.isn]['length'] = size;
      // isn段的起始
      this.data[this.isn]['isn'] = this.isn
      // 最后一个seq的前一个，(左闭右开]
      this.data[this.isn]['last'] = this.isn + size;
      // 下一个可以使用的seq
      this.data[this.isn]['next'] = this.isn + 1;
      return this.isn;
    }

    // 数据包确认后，即时释放和清除
    free(isn) {
      delete this.data[isn]
    }

    get(isn) {
      // 返回可用的最新的seq，然后自增
      // TODO，超过length的处理
      // 1. 动态分配
      // 2. 主动释放之前有的需要，且再次同一个isn下复用
      let seq = this.data[isn]['next']++
      // 写入一个待确认的seq
      this.data[isn]['ack'].push(seq)
      return seq
    }

    // 从一个isn, 删除已确认的数据包seq
    del(seq) {
      let isn = this.location(seq);
      let isn_info = this.data[isn] || { ack: [] }
      let index = isn_info['ack'].indexOf(seq)
      if (index >= 0) {
        return this.data[isn]['ack'].splice(index, 1)
      }
      return null
    }

    // 获取一个isn的所有待确认的seq
    ack(isn) {
      return this.data[isn]
    }

    // 定位一个seq属于哪个isn段内
    location(seq) {
      let isn = null
      for (let key in this.data) {
        if (this.data[key]['ack'].indexOf(seq) >= 0) {
          isn = key;
        }
      }
      return isn;
    }
    // 检测一个seq是否被确认
    // -1 invalid, 0 no checked, 1 checked
    check(seq) {
      let has = false
      for (let key in this.data) {
        // 属于某个isn段，且在对应的ack列表
        if (seq >= this.data[key]['isn'] && seq < this.data[key]['last']) {
          has = true
          if (this.data[key]['ack'].indexOf(seq) >= 0) {
            return 0
          } else {
            return 1
          }
        }
      }
      return has == false ? -1 : 0
    }
  }


  const BEGIN = 0x0
  const DOING = 0x1
  const DONED = 0x2
  const BDD = 0x3

  const ABEGIN = 0x80
  const ADOING = 0x81
  const ADONED = 0x82
  const ABDD = 0x83

  // header反消息类型
  const rHeadeType = {
    "BEGIN": BEGIN,
    "DOING": DOING,
    "DONED": DONED,
    "BEGIN|DOING|DONED": BDD,
    "A_BEGIN": ABEGIN,
    "A_DOING": ADOING,
    "A_DONED": ADONED,
    "A_BEGIN|A_DOING|A_DONED": ABDD,
  }

  // header消息类型
  const HeaderType = {
    // 发送数据包类型
    [BEGIN]: "BEGIN",
    [DOING]: "DOING",
    [DONED]: "DONED",
    [BDD]: "BEGIN|DOING|DONED",
    // 确认数据包类型
    [ABEGIN]: "A_BEGIN",
    [ADOING]: "A_DOING",
    [ADONED]: "A_DONED",
    [ABDD]: "A_BEGIN|A_DOING|A_DONED"
  }

  class Header {
    constructor(type, dup, qos, ack) {
      this.bits = 0
      if (!this.invalidType(type)) {
        throw Error("invalid type", type);
      }
      this.setType(type);
      if (dup && 1 == dup) {
        this.setDup();
      }
      if (qos && 1 == qos) {
        this.setQos();
      }
      if (ack && 1 == ack) {
        this.setAck();
      }
    }
    // 检测有效的类型
    invalidType(mtype) {
      return HeaderType[mtype]
    }
    // 设置mtype的每一个bit
    addType(flag) {
      return this.bits |= flag
    }
    // 设置mtype的每一个bit
    setType(flag) {
      this.bits &= 0xfc;
      return this.bits |= flag
    }
    // 设置dup位
    setDup() {
      return this.bits |= 0x8
    }
    // 设置qos位
    setQos() {
      return this.bits |= 0x10;
    }
    // 设置ack位
    setAck() {
      return this.bits |= 0x80;
    }
    // 从数据反构造一个header
    static New(bits) {
      let type = (bits & 0x3) | (bits & 0x80)
      if (!HeaderType[type]) {
        throw Error("invalid type new", bits);
      }
      let dup = (bits & 0x08) >>> 3;
      let qos = (bits & 0x10) >>> 4;
      return new Header(type, dup, qos);
    }

    // header属性
    Type() {
      return (this.bits & 0x3) | (this.bits & 0x80);
    }
    Dup() {
      return (this.bits & 0x08) >>> 3;
    }
    Qos() {
      return (this.bits & 0x10) >>> 4;
    }
    Ack() {
      return (this.bits & 0x80) >>> 7;
    }
    // 获取header信息
    info() {
      return {
        type: this.Type(), // type
        dup: this.Dup(),   // dup
        qos: this.Qos(),   // qos
        ack: this.Ack(),   // ack
        str: this.bits.toString(2)
      }
    }
    header() {
      return this.bits;
    }

    // 测试
    static testHeader() {
      // type test
      for (let key in rHeadeType) {
        let head1 = new Header(rHeadeType[key]);
        console.log("type Tesing info:", head1.info());
        console.log("type Tesing data:", head1.header());
        console.log("type Tesing Type:", head1.Type());
        console.log("type Tesing Qos:", head1.Qos());
        console.log("type Tesing Dup:", head1.Dup());
        console.log("type Tesing Ack:", head1.Ack());
      }
      // Dup test
      for (let key in rHeadeType) {
        let head1 = new Header(rHeadeType[key], 1);
        console.log("dup Tesing info:", head1.info());
        console.log("dup Tesing data:", head1.header());
        console.log("dup Tesing Type:", head1.Type());
        console.log("dup Tesing Qos:", head1.Qos());
        console.log("dup Tesing Dup:", head1.Dup());
        console.log("dup Tesing Ack:", head1.Ack());
      }
      // Qos test
      for (let key in rHeadeType) {
        let head1 = new Header(rHeadeType[key], 0, 1);
        console.log("qos Tesing info:", head1.info());
        console.log("qos Tesing data:", head1.header());
        console.log("qos Tesing Type:", head1.Type());
        console.log("qos Tesing Qos:", head1.Qos());
        console.log("qos Tesing Dup:", head1.Dup());
        console.log("qos Tesing Ack:", head1.Ack());
      }
      // All test
      for (let key in rHeadeType) {
        let head1 = new Header(rHeadeType[key], 1, 1);
        console.log("all Tesing info:", head1.info());
        console.log("all Tesing data:", head1.header());
        console.log("all Tesing Type:", head1.Type());
        console.log("all Tesing Qos:", head1.Qos());
        console.log("all Tesing Dup:", head1.Dup());
        console.log("all Tesing Ack:", head1.Ack());
      }
      // // test New
      let header = Header.New(0)
      console.log("Tesing new info:", header.info());
      header = Header.New(1)
      console.log("Tesing new info:", header.info());
      header = Header.New(2)
      console.log("Tesing new info:", header.info());
      header = Header.New(3)
      console.log("Tesing new info:", header.info());
      header = Header.New(128)
      console.log("Tesing new info:", header.info());
      header = Header.New(129)
      console.log("Tesing new info:", header.info());
      header = Header.New(130)
      console.log("Tesing new info:", header.info());
      header = Header.New(131)
      console.log("Tesing new info:", header.info());
      header = Header.New(8)
      console.log("Tesing new info:", header.info());
      header = Header.New(9)
      console.log("Tesing new info:", header.info());
      header = Header.New(10)
      console.log("Tesing new info:", header.info());
      header = Header.New(11)
      console.log("Tesing new info:", header.info());
      header = Header.New(136)
      console.log("Tesing new info:", header.info());
      header = Header.New(137)
      console.log("Tesing new info:", header.info());
      header = Header.New(138)
      console.log("Tesing new info:", header.info());
      header = Header.New(139)
      console.log("Tesing new info:", header.info());
      header = Header.New(16)
      console.log("Tesing new info:", header.info());
      header = Header.New(17)
      console.log("Tesing new info:", header.info());
      header = Header.New(18)
      console.log("Tesing new info:", header.info());
      header = Header.New(19)
      console.log("Tesing new info:", header.info());
      header = Header.New(144)
      console.log("Tesing new info:", header.info());
      header = Header.New(145)
      console.log("Tesing new info:", header.info());
      header = Header.New(146)
      console.log("Tesing new info:", header.info());
      header = Header.New(147)
      console.log("Tesing new info:", header.info());
      header = Header.New(24)
      console.log("Tesing new info:", header.info());
      header = Header.New(25)
      console.log("Tesing new info:", header.info());
      header = Header.New(26)
      console.log("Tesing new info:", header.info());
      header = Header.New(27)
      console.log("Tesing new info:", header.info());
      header = Header.New(152)
      console.log("Tesing new info:", header.info());
      header = Header.New(153)
      console.log("Tesing new info:", header.info());
      header = Header.New(154)
      console.log("Tesing new info:", header.info());
      header = Header.New(155)
      console.log("Tesing new info:", header.info());
      header = Header.New(156)
      console.log("Tesing new info:", header.info());
    }
  }

  const InitFd = () => {
    return {
      3: {
        fd: 3,
        flag: FSYNC,
        time: utils.GetTimestamp(),
      },
      4: {
        fd: 4,
        flag: FLOCAL,
        time: utils.GetTimestamp(),
      }
    }
  }

  // 基于wx.UDPSocket的基础类
  class BaseUdper {
    constructor(port) {
      // 用于udp通信时的事件通知
      this.$e = _event
      // udp通信绑定的port，默认5328
      this.bport = port;
      // 文件描述符表
      this.fds = InitFd()
      /**
       * 0 1 2 标准输入 标准输出 标准错误
       * 3 同步数据 占用
       * 4 定位数据 占用
       * 传输数据从5 开始使用
       */
      this.maxfd = 5
      this.timer = {}
      this.packer = new Packer();
      this.recver = {}
      // 获取随机分配的设备id，用于唯一标识
      this.id = this.getId();
      this.create(port);
    }

    // 私有方法
    _send(ip, port, msg) {
      return this.udper.send({ address: ip, port: port, message: msg });
    }
    // 错误处理
    error(msg) {
      throw new Error(msg);
    }

    // 初始化udp相关回调
    init() {
      if (this.udper) {
        this.onListening();
        this.offListening();
        this.onMessage();
        this.offMessage();
        this.onClose();
        this.offClose();
      }
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
          id = utils.RandomNum(0, IDMAX)
          wx.setStorage({
            data: {
              id: id
            },
            key: 'LOCAL',
          })
        }
      } catch (e) {
        id = utils.RandomNum(0, IDMAX)
        wx.setStorage({
          data: {
            id: id
          },
          key: 'LOCAL',
        })
      }
      id = utils.Pad(id, IDLEN)
      return id
    }
    onClose() {
      return new Promise((resolver) => {
        this.udper.onClose(function (res) {
          console.log("onClose: ", res);
          resolver({
            message: utils.NewAb2Str(res.message),
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
            message: utils.NewAb2Str(res.message),
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
            message: utils.NewAb2Str(res.message),
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
            message: utils.NewAb2Str(res.message),
            IPinfo: res.remoteInfo,
          });
        });
      });
    }
    onListening() {
      return new Promise((resolver) => {
        this.udper.onListening(function (res) {
          resolver({
            message: utils.NewAb2Str(res.message),
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
            message: utils.NewAb2Str(res.message),
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

    // 消息处理

    // 接受数据时的回调
    onMessage() {
      let self = this;
      self.udper.onMessage(function (res) {
        let { mtype, seq, peerInfo, data } = self.getData(res.remoteInfo, res.message)
        if (mtype < rMsgType["A_SYNCS"]) {
          self._handleOnMessage(mtype, seq, peerInfo, data)
        } else {
          self._handleAckMessage(mtype, seq, peerInfo, data)
        }
      });
    }
    // 检测有效的类型
    invalidMtype(mtype) {
      return MsgType[mtype]
    }
    // 设置mtype的每一个bit
    setMtype(mtype, flag) {
      return mtype |= rMsgType[flag]
    }
    // 设置mtype的每一个bit
    getMtype(mtype, flag) {
      return mtype & rMsgType[flag]
    }
    // 设置非ACK类型消息的header
    setHeader(fd, mtype, size, max_size) {
      let msg = new Messge();
      let header = new Header(mtype)
      let seq = null
      let fdinfo = this.fdinfo(fd)
      let isn = fdinfo.isn
      switch (mtype) {
        case rMsgType['SYNCS']:
        case rMsgType['LOCAL']:
          seq = this.packer.malloc(1)
          fdinfo['isn'] = seq
          break;
        case rMsgType['BEGIN']:
          // 首个数据包，将申请一个新的isn
          if (!isn) {
            seq = this.packer.malloc()
            fdinfo['isn'] = seq
            // 消息数据包（小于PACK_SIZE），只用占用一个数据包
            if (size <= max_size) {
              header.addType(BDD)
              mtype = this.setMtype(mtype, 'DOING|DONED')
            }
          } else {
            seq = this.packer.get(fdinfo['isn'])
            if (size == max_size) { // 传输过程数据包
              header.setType(DOING);
              mtype = rMsgType['DOING']
            } else { // size < max_size 传输到最后一个数据包
              header.setType(DONED);
              mtype = rMsgType['DOING|DONED']
            }
          }
          break;
        default:
          break;
      }
      msg.writeNumber(mtype, 1);   // 消息类型，1byte
      msg.writeNumber(seq, 4);     // 消息数据包序号 4byte      
      msg.writeNumber(this.id, 2); // 发送端id  2byte
      return { msg: msg, seq: seq };
    }
    // 从获取的数据解析header，与set_header对应
    getHeader(data) {
      let msg = new Messge(data);
      let mtype = msg.readNumber(1);
      let header = Header.New(mtype)
      let seq = msg.readNumber(4);
      return {
        msg: msg,
        mtype: mtype,
        seq: seq,
        peerId: utils.Pad(msg.readNumber(2), IDLEN),
      }
    }
    // 生成发送的数据包
    setData(fd, mtype, data, max_size) {
      data = this.serialize(data)
      // 数据包大小处理, 截取前 max_size, PACK_SIZE
      if (data && (data.length > max_size)) {
        data = data.slice(0, max_size);
      }
      let { msg, seq } = this.setHeader(fd, mtype, data.length, max_size);
      msg.writeString(data); // 消息内容
      return { msg: msg.buffer, seq: seq, size: data.length };
    }
    // 解析收到的的数据包
    getData(peer, dat) {
      let { msg, mtype, seq, peerId } = this.getHeader(dat);
      let data = msg.readString(); // 消息内容
      let peerInfo = peer || {}
      peerInfo.peerId = peerId
      return { mtype: mtype, seq: seq, peerInfo: peerInfo, data: data }
    }

    // 传输管理

    // 新建一次新的传输过程，分配一个唯一的fd
    open(ip, port, flag) {
      this.fds[this.maxfd] = {
        ip: ip,
        port: port,
        fd: this.maxfd,
        flag: flag || FB00,
        time: utils.GetTimestamp(),
      }
      return this.maxfd++;
    }
    // 关闭一次传输, 释放对应的fd
    close(fd) {
      delete this.fds[fd];
    }
    // 通过fd获取对应的信息
    fdinfo(fd) {
      return this.fds[fd];
    }

    // 生成发送的数据包
    setAckData(mtype, data, seq) {
      data = this.serialize(data)
      let msg = new Messge();
      msg.writeNumber(mtype, 1);   // 消息类型，1byte
      msg.writeNumber(seq, 4);     // 消息数据包序号 4byte      
      msg.writeNumber(this.id, 2); // 发送端id  2byte      
      msg.writeString(data);       // 消息内容
      return { msg: msg.buffer, seq: seq, size: data.length };
    }

    // 由于数据包会再未收到对应ACK包时会重传，针对ACK包无需设置超时重传
    sendAck(ip, port, mtype, a_seq) {
      let self = this;
      let amtype = this.setMtype(mtype, 'A_SYNCS');
      return new Promise((resolver, reject) => {
        if (!self.invalidMtype(amtype)) {
          reject({ peerIp: ip, peerPort: port, err: 'INVALID MESSAGE TYPE: ' + amtype });
        }
        // 生成代发送的数据包 seq 只有再Ack包是传入
        let { msg, seq, size } = self.setAckData(amtype, '', a_seq);
        // 调用发送
        self._send(ip, port, msg)
        resolver({ err: 'ok', size: size, seq: seq, peerIp: ip, peerPort: port });
      });
    }

    // 向某个ip:port发送类型mtype的消息data
    send(fd, ip, port, mtype, payload) {
      let self = this;
      console.log(fd, self.fdinfo(fd))
      let PACK_SIZE = utils.IsLanIP(ip) ? WAN_PACK_SIZE : LAN_PACK_SIZE;
      return new Promise((resolver, reject) => {
        if (!self.invalidMtype(mtype)) {
          reject({ err: 'INVALID MESSAGE TYPE: ' + mtype, peerIp: ip, peerPort: port });
        }
        // 生成代发送的数据包 seq 只有再Ack包是传入
        let { msg, seq, size } = self.setData(fd, mtype, payload, PACK_SIZE);
        // 设置超时定时器                
        let intervalID = setInterval(function () {
          console.log('retry send', mtype, ip, port)
          if (self.retry++ < RETRY) {
            self._send(ip, port, msg)
          } else {
            clearInterval(intervalID);
            delete self.timer[seq];
          }
        }, ACK_TIMEOUT);
        self.timer[seq] = { ip: ip, seq: seq, id: intervalID, }
        // 定义事件通知
        let event_id = self.online[ip] + ':' + seq
        self.$e.on1(event_id, self, res => {
          console.log('ack:', res);
          self.retry = 0;
          clearInterval(intervalID);
          delete self.timer[seq];
        });
        // 调用发送
        self._send(ip, port, msg)
        resolver({ err: 'ok', size: size, seq: seq, peerIp: ip, peerPort: port });
      });
    }
    // 通过id发送mtype消息的数据data
    sendById(fd, id, payload) {
      let self = this;
      let info = self.getOthers(id) || [];
      if (id && info.length > 0) {
        let fdinfo = self.fdinfo(fd);
        fdinfo.ip = info[0].address
        fdinfo.port = info[0].port
      }
      return Promise.all(info.map((item) => {
        return self.send(fd, item.address, item.port, 2, payload);
      }));
    }

    // 数据处理工具
    // serialize the data
    serialize(data) {
      let type = utils.Type(data);
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
        self.offline()
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
      return this.send(4, '255.255.255.255', this.bport, 1, '');
    }
    // 下线广播
    offline() {
      if (this.online[this.id]) {
        return this.send(4, '255.255.255.255', this.bport, 0, '-' + this.id);
        // this.upper.close()
      }
    }
    // 向某一个设备id发送同步类型的数据，主要是同步本设备的数据更新
    sync(id, msg) {
      let info = (this.getOthers(id) || [])[0];
      if (info) {
        return this.send(3, info.address, info.port, 0, msg);
      }
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
      let data = {
        seq: seq,
        message: message,
        IPinfo: peerInfo,
        peerId: peerInfo.peerId,
        iPint: utils.Ip2Int(peerInfo.address),
      };
      switch (mtype) {
        case rMsgType['A_SYNCS']:
          break;
        case rMsgType['A_LOCAL']:
          break;
        case rMsgType['A_BEGIN']:
          break;
        case rMsgType['A_DOING']:
          break;
        case rMsgType['A_DONED']:
          break;
        default:
          break;
      }
      let event_id = peerInfo.peerId + ':' + seq
      data.type = MsgType[mtype];
      this.packer.del(seq);
      delete this.recver[seq];
      this.$e.emit(event_id, data);
    }
    // 处理来自网络的数据包
    _handleOnMessage(mtype, seq, peerInfo, message) {
      // console.log("onMessage: ", res)
      let data = {
        seq: seq,
        message: message,
        IPinfo: peerInfo,
        peerId: peerInfo.peerId,
        iPint: utils.Ip2Int(peerInfo.address),
      };
      let ack_flag = this.packer.check(seq)
      // 发送确认数据包
      // if (ack_flag >= 0) {
      this.sendAck(peerInfo.address, peerInfo.port, mtype, seq);
      // }
      if (!this.recver[seq]) {
        switch (mtype) {
          case rMsgType['SYNCS']:
            data.type = 'SYNCS';
            this._handleSync(data);
            break;
          case rMsgType['LOCAL']:
            data.type = 'LOCAL';
            this._handleLocal(data);
            break;
          case rMsgType['BEGIN']:
            data.type = 'BEGIN';
            this.event.emit("onMessage", data);
            break;
          case rMsgType['DOING']:
            data.type = 'DOING';
            this.event.emit("onMessage", data);
            break;
          case rMsgType['DONED']:
            data.type = 'DONED';
            this.event.emit("onMessage", data);
            break;
          default:
            data.type = mtype;
            this.event.emit("onMessage", data);
            break;
        }
        this.recver[seq] = data
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
            let copy = Object.assign({ id: this.id }, this.online[this.id]);
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
        if (prop != 'length' && 'string' != (typeof copy[prop]) /* && prop != this.id*/) {
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
      this.online[address] = id;
      console.log("addOnline +++: ", this.online[id]);
      return this.online[id];
    }
    // 删除下线用户id
    delOnline(id) {
      let one = this.online[id];
      if (one) {
        delete this.online[id];
        delete this.online[one.address];
        this.online.length--;
        console.log("delOnline --: ", one);
      }
      return one;
    }
  }


  exports.Udper = Udper;
  exports.Header = Header;
  // 局域网最大数据包大小
  BaseUdper.prototype.LAN_PACK_SIZE = LAN_PACK_SIZE
  // 广域网最大数据包大小
  BaseUdper.prototype.WAN_PACK_SIZE = WAN_PACK_SIZE
  // 数据包消息类型
  BaseUdper.prototype.MsgType = MsgType
  // 数据包反消息类型
  BaseUdper.prototype.rMsgType = rMsgType
  // 标志位
  // 同步数据包
  BaseUdper.prototype.FSYNC = FSYNC
  // 定位数据包
  BaseUdper.prototype.FLOCAL = FLOCAL
  // 首个数据包
  BaseUdper.prototype.FB00 = FB00
  // 大型数据包中间数据包
  BaseUdper.prototype.F0D0 = F0D0
  // 结束数据包
  BaseUdper.prototype.F00D = F00D
  // 既是中间数据包又是结束数据包
  BaseUdper.prototype.F0DD = F0DD
  // 对于小型数据, 首个数据包既是中间数据包又是最后一个数据包
  BaseUdper.prototype.FBDD = FBDD
  // 确认标志位
  // 确认同步数据包
  BaseUdper.prototype.A_SYNC = A_SYNC
  // 确认定位数据包
  BaseUdper.prototype.A_LOCAL = A_LOCAL
  // 确认首个数据包
  BaseUdper.prototype.A_B00 = A_B00
  // 确认大型数据包中间数据包
  BaseUdper.prototype.A_0D0 = A_0D0
  // 确认结束数据包
  BaseUdper.prototype.A_00D = A_00D
  // 确认既是中间数据包又是结束数据包
  BaseUdper.prototype.A_0DD = A_0DD
  // 确认对于小型数据, 首个数据包既是中间数据包又是最后一个数据包
  BaseUdper.prototype.A_BDD = A_BDD
});