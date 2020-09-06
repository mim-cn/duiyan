/**
 * format：
 *         7      6      5      4      3      2      1      0   
 *     +------+------+------+------+------+------+------+------+
 *     | ack  |retain|retain|  qos |  dup |retain|     type    |   头部（1byte）
 *     +------+------+------+------+------+------+------+------+
 *     |                 Sequence Number(4byte)                |   序列号（4byte）
 *     +------+------+------+------+------+------+------+------+
 *     |                    Checksum(2byte)                    |   校验和（2byte）
 *     +------+------+------+------+------+------+------+------+
 *     |                      data(nbyte)                      |   数据（nbyte）
 *     +------+------+------+------+------+------+------+------+
 * 
 * header：
 *   1 byte 0:
 *     0[0000 0000b]: "BROAD"  广播局域网内状态  <=>  128[1000 0000b]: "ABROAD"  确认同步
 *     1[0000 0001b]: "MULTI"  多播的传输数据包  <=>  129[1000 0001b]: "AMULTI"  确认定位
 *     2[0000 0010b]: "BEGIN"  首次开始数据传输  <=>  130[1000 0010b]: "ABEGIN"  确认开始
 *     3[0000 0011b]: "DOING"  中间数据传输过程  <=>  131[1000 0011b]: "ADOING"  确认数据
 *     4[0000 0100b]: "DONED"  结束数据传输过程  <=>  132[1000 0100b]: "ADONED"  确认结束
 *     5[0000 0101b]: "BDD"    整包数据传输过程  <=>  133[1000 0101b]: "ABDD"    确认整包
 * seq
 *   4 byte 1 ~ 4:
 *     sequence
 * checksum
 *   2 byte 5 ~ 6:
 *     crc16 checksum
 * data
 *   n byte 7 ~  wan MAX: 548-7 = 541 ~= 512 ; lan MAX: 1472-7 = 1465 ~= 1024
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
  const cache = require('../common/cache')
  const _event = require('../common/event.js')
  const {
    Messge
  } = require("./message");

  const IDLEN = 5
  const IDMAX = Math.pow(10, IDLEN)
  const RIGHT_MOVE = 11
  const ISN_INTERVAL = 1 << RIGHT_MOVE  // 2048

  const EXPIRE = 60000 // 60s

  // 重传机制超时时间
  const ACK_TIMEOUT = 2000
  // 局域网最大数据包大小
  const LAN_PACK_SIZE = 1024
  // 广域网最大数据包大小
  const WAN_PACK_SIZE = 512
  // 重试次数
  const RETRY = 100

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
  class SeqManage {
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

  class Stat {
    constructor() {
      this.props = {}
    }
    incr(key, v) {
      return this.props[key] ? this.props[key] += (v || 1) : this.props[key] = (v || 1);
    }
    decr(key) {
      return this.props[key] ? this.props[key]-- : this.props[key] = 0;
    }
  }

  const FD_BROAD = 3 // 广播占用fd
  const FD_MULTI = 4 // 多播占用fd
  // 数据包类型
  const BROAD = 0x0  // 广播数据包
  const MULTI = 0x1  // 多播数据包
  const BEGIN = 0x2  // 首个数据包
  const DOING = 0x3  // 大型数据包中间数据包
  const DONED = 0x4  // 结束数据包
  const BDD = 0x5    // 对于小型数据, 首个数据包既是中间数据包又是最后一个数据包

  // 确认数据包
  const ABROAD = 0x80 | BROAD  // 广播数据包
  const AMULTI = 0x80 | MULTI  // 多播数据包
  const ABEGIN = 0x80 | BEGIN  // 首个数据包
  const ADOING = 0x80 | DOING  // 大型数据包中间数据包
  const ADONED = 0x80 | DONED  // 结束数据包
  const ABDD = 0x80 | BDD  // 对于小型数据, 首个数据包既是中间数据包又是最后一个数据包

  // header反消息类型
  const rHeaderType = {
    "BROAD": BROAD,
    "MULTI": MULTI,
    "BEGIN": BEGIN,
    "DOING": DOING,
    "DONED": DONED,
    "BDD": BDD,
    "ABROAD": ABROAD,
    "AMULTI": AMULTI,
    "ABEGIN": ABEGIN,
    "ADOING": ADOING,
    "ADONED": ADONED,
    "ABDD": ABDD,
  }

  // header消息类型
  const HeaderType = {
    // 发送数据包类型
    [BROAD]: "BROAD",
    [MULTI]: "MULTI",
    [BEGIN]: "BEGIN",
    [DOING]: "DOING",
    [DONED]: "DONED",
    [BDD]: "BDD",
    // 确认数据包类型
    [ABROAD]: "ABROAD",
    [AMULTI]: "AMULTI",
    [ABEGIN]: "ABEGIN",
    [ADOING]: "ADOING",
    [ADONED]: "ADONED",
    [ABDD]: "ABDD"
  }

  /**
   * 数据包头解析
   */
  class Header {
    constructor(type, dup, qos, ack) {
      this.bits = 0
      if (!this.invalidType(type)) {
        throw Error("invalid type", type);
      }
      this.setType(type);
      (dup === 1) ? this.setDup(dup) : null;
      (qos === 1) ? this.setQos(qos) : null;
      (ack === 1) ? this.setAck(ack) : null;
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
    // 设置dup位(4)
    setDup(flag) {
      return (1 === flag) ? this.bits |= 0x08 : ((0 === flag) ? this.bits &= 0xf7 : this.bits);
    }
    // 设置qos位(5)
    setQos(flag) {
      return (1 === flag) ? this.bits |= 0x10 : ((0 === flag) ? this.bits &= 0xef : this.bits);
    }
    // 设置ack位(7)
    setAck(flag) {
      return (1 === flag) ? this.bits |= 0x80 : ((0 === flag) ? this.bits &= 0x7f : this.bits);
    }
    // 从数据反构造一个header
    static New(bits) {
      let type = (bits & 0x7) | (bits & 0x80)
      if (!HeaderType[type]) {
        throw Error("invalid type new", bits);
      }
      let dup = (bits & 0x08) >>> 3;
      let qos = (bits & 0x10) >>> 4;
      return new Header(type, dup, qos);
    }

    // header属性
    Type() {
      return (this.bits & 0x7) | (this.bits & 0x80);
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
        str: this.bits.toString(2),
        desc: HeaderType[this.Type()],
      }
    }
    header() {
      return this.bits;
    }

    // 测试
    static testHeader() {
      // type test
      let heads = []
      for (let key in rHeadeType) {
        let head1 = new Header(rHeadeType[key]);
        heads.push(head1.header());
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
        heads.push(head1.header());
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
        heads.push(head1.header());
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
        heads.push(head1.header());
        console.log("all Tesing info:", head1.info());
        console.log("all Tesing data:", head1.header());
        console.log("all Tesing Type:", head1.Type());
        console.log("all Tesing Qos:", head1.Qos());
        console.log("all Tesing Dup:", head1.Dup());
        console.log("all Tesing Ack:", head1.Ack());
      }
      // test New
      for (let i in heads) {
        let header = Header.New(heads[i])
        console.log("Tesing new info:", header.info());
      }
    }
  }

  /**
   * package 解析器
   */
  class Package {
    constructor(type, dup, qos, ack, pkg) {
      this.header = null;
      this.buffer = null;
      if ("Number" === utils.Type(type)) {
        this.header = new Header(type, dup, qos, ack);
      }
      if (pkg && "Object" === utils.Type(pkg)) {
        this.seq = pkg.seq;
        this.payload = pkg.payload || "";
        this.build(this.header.header(), this.seq, this.payload);
      }
    }

    // 构建pack
    build(header, seq, payload) {
      let [msg, checksum] = Package.pack(header, seq, payload);
      this.buffer = msg.buffer
      this.checksum = checksum
    }

    // 设置header的标志位
    setFlags(dup, qos, ack) {
      let s0 = (dup !== this.header.Dup()) ? this.header.setDup(dup) : null;
      let s1 = (qos !== this.header.Qos()) ? this.header.setQos(qos) : null;
      let s2 = (ack !== this.header.Ack()) ? this.header.setAck(ack) : null;
      if (s0 || s1 || s2) {
        this.build(this.header.header(), this.seq, this.payload);
      }
    }

    // 编码数据包结构
    static pack(header, seq, payload) {
      let msg = new Messge();
      msg.writeNumber(header, 1);      // 消息类型，1byte
      msg.writeNumber(seq, 4);         // 消息数据包序号 4byte
      msg.writeNumber(0x0, 2);         // 消息checksum 2byte
      msg.writeString(payload);        // 消息内容
      let checksum = utils.Crc16(msg.toBytes());
      msg.setNumber(checksum, 2, 5);   // 消息checksum 2byte
      return [msg, checksum];
    }

    // 解码数据包
    static unpack(buffer) {
      let pkg = new Package();
      pkg.buffer = buffer;
      let msg = new Messge(buffer);
      pkg.header = Header.New(msg.readNumber(1));  // 消息类型，1byte
      pkg.seq = msg.readNumber(4);                 // 消息数据包序号 4byte
      pkg.checksum = msg.readNumber(2);            // 消息checksum 2byte
      pkg.payload = msg.readString();              // 消息内容
      msg.setNumber(0, 2, 5);
      let checksum = utils.Crc16(msg.toBytes());
      return (checksum == pkg.checksum) ? pkg : null;
    }
  }

  const InitFd = () => {
    return {
      [FD_BROAD]: {
        fd: FD_BROAD,
        flag: BROAD,
        time: utils.GetTimestamp(),
      },
      [FD_MULTI]: {
        fd: FD_MULTI,
        flag: MULTI,
        time: utils.GetTimestamp(),
      }
    }
  }

  class UdpBase {
    constructor(port) {
      this.create(port);
    }
    create(port) {
      try {
        this.udper = wx.createUDPSocket();
        this.udper.bind(port);
      } catch (e) {
        console.error("createUDPSocket:", e);
        throw Error("create udp socket error!!!");
      }
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
  }

  // 基于wx.UDPSocket的基础类
  class BaseUdper extends UdpBase {
    constructor(port) {
      super(port);
      // 用于udp通信时的事件通知
      this.$e = _event
      // udp通信绑定的port，默认5328
      this.bport = port;
      // 文件描述符表
      this.fds = InitFd()
      /**
       * 0 1 2 标准输入 标准输出 标准错误
       * 3 广播数据包 占用
       * 4 多播数据包 占用
       * 传输数据从5 开始使用
       */
      this.maxfd = 5
      this.timer = {}
      this.seqer = new SeqManage();
      this.recver = {}
      this.stat = new Stat();
      // 获取随机分配的设备id，用于唯一标识
      this.id = this.getId();
    }

    // 获取分配的随机id
    getId() {
      let id = null
      try {
        let res = cache.get('LOCAL');
        if (res) {
          id = res
        } else {
          id = utils.RandomNum(0, IDMAX)
          cache.set('LOCAL', id, EXPIRE);
        }
      } catch (e) {
        id = utils.RandomNum(0, IDMAX)
        cache.set('LOCAL', id, EXPIRE);
      }
      id = utils.Pad(id, IDLEN)
      return id
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

    // 消息处理

    // 接受数据时的回调
    onMessage() {
      let self = this;
      self.udper.onMessage(function (res) {
        let { mtype, seq, peerInfo, data } = self.decode(res.remoteInfo, res.message);
        if (mtype < ABROAD) {
          self._handleOnMessage(mtype, seq, peerInfo, data)
        } else {
          self._handleAckMessage(mtype, seq, peerInfo, data)
        }
      });
    }

    // 传输管理

    // 新建一次新的传输过程，分配一个唯一的fd
    open(ip, port, flag) {
      this.fds[this.maxfd] = {
        ip: ip,
        port: port,
        fd: this.maxfd,
        flag: flag || BEGIN,
        time: utils.GetTimestamp(),
      }
      return this.maxfd++;
    }
    // 关闭一次传输, 释放对应的fd
    close(fd) {
      delete this.fds[fd];
    }
    // 通过fd获取对应的信息
    fstat(fd) {
      return this.fds[fd];
    }

    // 根据传输过程和payload调整数据包类型
    encode(fd, mtype, a_seq, payload, max_size) {
      // STAT 统计发送数据包个数
      this.stat.incr('pgc');
      let seq = 0
      let data = this.serialize(payload)
      if (data && (data.length > max_size)) {
        data = data.slice(0, max_size);
      }
      let size = data.length;
      // 确认包
      if (a_seq !== null) {
        this.stat.incr('ackpgc');
        let pkg = { seq: a_seq, size: size, type: mtype, payload: data }
        let pack = new Package(mtype, 0, 0, 1, pkg);
        return { seq: a_seq, size: size, type: pack.header.Type(), pack: pack }
      }
      // 数据包
      let fstat = this.fstat(fd)
      let isn = fstat.isn
      switch (mtype) {
        case BEGIN:
          // 首个数据包，将申请一个新的isn
          if (!isn) {
            seq = this.seqer.malloc();
            fstat['isn'] = seq;
            // 消息数据包（小于PACK_SIZE），只用占用一个数据包
            if (size <= max_size) {
              mtype = BDD;
              // STAT 统计发送小型数据包个数
              this.stat.incr('spgc');
            } else {
              // STAT 统计发送非小型数据包个数
              this.stat.incr('nspgc');
              mtype = BEGIN;
            }
          } else {
            seq = this.seqer.get(fstat['isn']);
            // size == max_size 传输过程数据包
            // size <  max_size 传输到最后一个数据包
            mtype = (size == max_size) ? DOING : DONED;
          }
          break;
        case BROAD:
        case MULTI:
          seq = this.seqer.malloc(1);
          fstat['isn'] = seq;
          break;
        default:
          throw Error("encode invalid type");
      }
      let pkg = { seq: seq, size: size, type: mtype, payload: data }
      let pack = new Package(mtype, 0, 0, 0, pkg);
      return { seq: seq, size: size, type: mtype, pack: pack }
    }

    decode(peer, buffer) {
      let pkg = Package.unpack(buffer);
      // STAT 统计接收数据包个数，错误数据包个数
      pkg ? this.stat.incr('rpgc') : this.stat.incr('erpgc');
      console.log("unpack:", pkg);
      let payload = pkg.payload, mtype = pkg.header.Type(), seq = pkg.seq;
      // STAT 统计接收小型数据包个数
      (mtype === BDD) ? this.stat.incr('rspgc') : null;
      // STAT 统计接收非小型数据包个数
      (mtype === BEGIN) ? this.stat.incr('rnspgc') : null;
      // STAT 统计接收非小型数据包个数
      (mtype >= ABROAD) ? this.stat.incr('rackpgc') : null;
      this.event.emit("kudp-stat", this.statist());
      return { mtype: mtype, seq: seq, peerInfo: (peer || {}), data: payload }
    }

    // 由于数据包会再未收到对应ACK包时会重传，针对ACK包无需设置超时重传
    sendAck(ip, port, mtype, a_seq) {
      let self = this;
      return new Promise((resolver, reject) => {
        try {
          // 编码数据包
          let { seq, size, type, pack } = self.encode(null, mtype, a_seq, '', null);
          // 调用发送
          self._send(ip, port, pack.buffer)
          resolver({ err: 'ok', size: size, seq: seq, type: type, peerIp: ip, peerPort: port });
        } catch (e) {
          console.error("sendAck:", e);
          reject(e);
        }
      });
    }

    // 定时器超时重传
    retry(seq, type, ip, port, pack) {
      let self = this;
      // 设置超时定时器
      let intervalID = setInterval(function () {
        console.log('retry send', type, ip, port, pack)
        // STAT 统计接重复发送数据包个数
        if (self.stat.incr('dup') < RETRY) {
          // 添加dup标志
          pack.setFlags(1, 0, 0);
          self.stat.incr('pgc');
          // STAT 统计接收小型数据包个数(dup)
          (pack.header.Type() === BDD) ? self.stat.incr('spgc') : null;
          // STAT 统计接收非小型数据包个数(dup)
          (pack.header.Type() === BEGIN) ? self.stat.incr('nspgc') : null;
          self._send(ip, port, pack.buffer)
        } else {
          clearInterval(intervalID);
          delete self.timer[seq];
        }
      }, ACK_TIMEOUT);
      self.timer[seq] = { ip: ip, seq: seq, id: intervalID }
      // 定义事件通知
      let event_id = utils.Ip2Int(ip) + ':' + seq;
      self.$e.on1(event_id, self, res => {
        console.log('ack:', res);
        clearInterval(intervalID);
        delete self.timer[seq];
      });
    }

    // 向某个ip:port发送类型mtype的消息data
    send(fd, ip, port, mtype, payload) {
      let self = this;
      let PACK_SIZE = utils.IsLanIP(ip) ? WAN_PACK_SIZE : LAN_PACK_SIZE;
      return new Promise((resolver, reject) => {
        try {
          // 编码数据包
          let { seq, size, type, pack } = self.encode(fd, mtype, null, payload, PACK_SIZE);
          // TODO: 广播，多播 是否需要重传？
          if (type > MULTI) {
            self.retry(seq, type, ip, port, pack);
          }
          // 调用发送
          self._send(ip, port, pack.buffer);
          resolver({ err: 'ok', size: size, seq: seq, type: type, peerIp: ip, peerPort: port });
        } catch (e) {
          console.error("send:", e);
          reject(e);
        }
      });
    }

    // 通过id发送mtype消息的数据data
    sendById(fd, id, payload) {
      let self = this;
      let info = []
      if (utils.IsIP(id)) {
        info = [{ address: id, port: this.bport }];
      } else {
        info = self.getOthers(id) || [];
        if (id && info.length > 0) {
          let fstat = self.fstat(fd);
          fstat.ip = info[0].address
          fstat.port = info[0].port
        }
      }
      return Promise.all(info.map((item) => {
        return self.send(fd, item.address, item.port, BEGIN, payload);
      }));
    }

    // 广播数据包
    broadcast(payload) {
      return this.send(FD_BROAD, '255.255.255.255', this.bport, BROAD, payload || "");
    }

    // 组播多播数据包 TODO
    multicast(payload) {
      return this.send(FD_MULTI, '255.255.255.255', this.bport, MULTI, payload || "");
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
      this.online = {
        length: 0
      };
      this.init();
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
      return this.broadcast('@' + this.id);
    }
    // 下线广播
    offline() {
      if (this.online[this.id]) {
        return this.broadcast('-' + this.id);
        // this.upper.close()
      }
    }
    // 向某一个设备id发送同步类型的数据，主要是同步本设备的数据更新
    sync(id, payload) {
      let info = (this.getOthers(id) || [])[0];
      if (info) {
        return this.send(FD_BROAD, info.address, info.port, BROAD, payload);
      }
    }

    // 消息处理方法

    // 处理[SYNC数据包]设备上下线，各设备之间数据同步的功能
    _handleSync(data) {
      let one = null
      data.message = data.message + ''
      let method = data.message[0];
      data.message = data.message.slice(1);
      switch (method) {
        case '@':
          return this._handleLocal(data);
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
      let one = this.addOnline(data.message, data.IPinfo.address, data.IPinfo.port);
      if (data.message == this.id) {
        one.id = this.id;
        data.id = this.id;
        data.type = "LOCAL"
        this.$e.once("localip", one);
        this.event.emit("onMessage", data);
      } else {
        // 向新上线的用户推送所有在线
        this.sync(data.message, '+' + this.id);
      }
      return one;
    }

    // 处理多播情况 TODO
    _handleMulti(data) {
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
        case ABROAD:
          break;
        case AMULTI:
          break;
        case ABEGIN:
          break;
        case ADOING:
          break;
        case ADONED:
          break;
        case ABDD:
          break;
        default:
          break;
      }
      let event_id = utils.Ip2Int(peerInfo.address) + ':' + seq
      data.type = HeaderType[mtype];
      this.seqer.del(seq);
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
      this.seqer.check(seq)
      // 发送确认数据包
      this.sendAck(peerInfo.address, peerInfo.port, mtype, seq);
      if (!this.recver[seq]) {
        switch (mtype) {
          case BROAD:
            data.type = 'BROAD';
            this._handleSync(data);
            break;
          case MULTI:
            data.type = 'MULTI';
            this._handleMulti(data);
            break;
          case BEGIN:
            data.type = 'BEGIN';
            this.event.emit("onMessage", data);
            break;
          case DOING:
            data.type = 'DOING';
            this.event.emit("onMessage", data);
            break;
          case DONED:
            data.type = 'DONED';
            this.event.emit("onMessage", data);
            break;
          case BDD:
            data.type = 'BDD';
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
    // 统计工具
    statist() {
      let format_str = ""
      for (let key in this.stat.props) {
        // console.log(key, this.stat.props[key]);
        if ('pgc' == key) {
          format_str = format_str + "\n" + "发送数据包：" + this.stat.props[key]
        } else if ('rpgc' == key) {
          format_str = format_str + "\n" + "接收数据包：" + this.stat.props[key]
        } else if ('ackpgc' == key) {
          format_str = format_str + "\n" + "发送确认数据包：" + this.stat.props[key]
        } else if ('rackpgc' == key) {
          format_str = format_str + "\n" + "接收确认数据包：" + this.stat.props[key]
        } else if ('dup' == key) {
          format_str = format_str + "\n" + "dup值：" + this.stat.props[key]
        } else if ('spgc' == key) {
          format_str = format_str + "\n" + "发送小型数据包：" + this.stat.props[key]
        } else if ('nspgc' == key) {
          format_str = format_str + "\n" + "发送非小型数据包：" + this.stat.props[key]
        } else if ('rspgc' == key) {
          format_str = format_str + "\n" + "接收小型数据包：" + this.stat.props[key]
        } else if ('rnspgc' == key) {
          format_str = format_str + "\n" + "接收非小型数据包：" + this.stat.props[key]
        } else if ('erpgc' == key) {
          format_str = format_str + "\n" + "错误数据包：" + this.stat.props[key]
        }
      }
      format_str = format_str.slice(1)
      return format_str
    }
  }

  exports.Udper = Udper;
  exports.Header = Header;
});