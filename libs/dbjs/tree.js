/*
	Tks https://github.com/vadimg/js_bintrees

  This package provides Binary and Red-Black Search Trees written in Javascript. It is released under the MIT License.

  Binary Search Trees are a good way to store data in sorted order. A Red-Black tree is a variation of a Binary Tree that balances itself.
*/

(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('tree', e);
  }
})(this, function (exports) {

  /**
   * 根据数据类型，生成默认比较器
   * @param {any} data 
   */
  function gen_comparator(data) {
    let type = typeof data
    switch (type) {
      case 'number':
        return function (a, b) {
          return a - b
        }
      case 'string':
        return function (a, b) {
          return a > b ? 1 : (a < b ? -1 : 0)
        }
      default:
        throw new Error('invalid comparator!!');
    }
  }
  /**
   * tree base operate
   */
  class TreeBase {
    constructor(name, type, comparator) {
      this.type = type
      this._name = name || 'treebase'
      if (comparator) {
        this._comparator = comparator;
      }
    }
    // removes all nodes from the tree
    clear() {
      this._root = null;
      this.size = 0;
    }
    // returns node data if found, null otherwise
    find(data) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var res = this._root;
      while (res !== null) {
        var c = this._comparator(data, res.data);
        if (c === 0) {
          return res;
        } else {
          res = res.get_child(c > 0);
        }
      }
      return null;
    }
    // returns iterator to node if found, null otherwise
    findIter(data) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var res = this._root;
      var iter = this.iterator();
      while (res !== null) {
        var c = this._comparator(data, res.data);
        if (c === 0) {
          iter._cursor = res;
          return iter;
        } else {
          iter._ancestors.push(res);
          res = res.get_child(c > 0);
        }
      }
      return null;
    }
    // Returns an iterator to the tree node at or immediately after the item
    lowerBound(item) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var cur = this._root;
      var iter = this.iterator();
      var cmp = this._comparator;

      while (cur !== null) {
        var c = cmp(item, cur.data);
        if (c === 0) {
          iter._cursor = cur;
          return iter;
        }
        iter._ancestors.push(cur);
        cur = cur.get_child(c > 0);
      }

      for (var i = iter._ancestors.length - 1; i >= 0; --i) {
        cur = iter._ancestors[i];
        if (cmp(item, cur.data) < 0) {
          iter._cursor = cur;
          iter._ancestors.length = i;
          return iter;
        }
      }

      iter._ancestors.length = 0;
      return iter;
    }
    // Returns an iterator to the tree node immediately after the item
    upperBound(item) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var iter = this.lowerBound(item);
      var cmp = this._comparator;

      while (iter.data() !== null && cmp(iter.data(), item) === 0) {
        iter.next();
      }

      return iter;
    }
    // returns null if tree is empty
    min() {
      var res = this._root;
      if (res === null) {
        return null;
      }

      while (res.left !== null) {
        res = res.left;
      }

      return res.data;
    }
    // returns null if tree is empty
    max() {
      var res = this._root;
      if (res === null) {
        return null;
      }

      while (res.right !== null) {
        res = res.right;
      }

      return res.data;
    }
    // returns a null iterator
    // call next() or prev() to point to an element
    iterator() {
      return new Iterator(this);
    }
    // calls cb on each node's data, in order
    each(cb) {
      var it = this.iterator(),
        data;
      while ((data = it.next()) !== null) {
        if (cb(data, it.other()) === false) {
          return;
        }
      }
    }
    // calls cb on each node's data, in reverse order
    reach(cb) {
      var it = this.iterator(),
        data;
      while ((data = it.prev()) !== null) {
        if (cb(data, it.other()) === false) {
          return;
        }
      }
    }
    // return range data from tree
    range(s, e, flag) {
      let ret = [],
        exist = true;
      flag = (flag && "string" === typeof flag) ? flag.toUpperCase() : ''
      try {
        if (!s && !e) {
          this.each(function (d, o) {
            ret.push({
              data: d,
              other: o
            })
          })
        } else if (s && !e) {
          let iter = this.findIter(s)
          if (flag.indexOf('L') != -1) {
            ret.push({
              data: iter.data(),
              other: iter.other()
            })
          }
          while (iter.next()) {
            ret.push({
              data: iter.data(),
              other: iter.other()
            })
          }
        } else if (!s && e) {
          let itere = this.findIter(e)
          if (flag.indexOf('R') != -1) {
            ret.unshift({
              data: iter.data(),
              other: iter.other()
            })
          }
          while (itere.prev()) {
            ret.unshift({
              data: iter.data(),
              other: iter.other()
            })
          }
        } else if (s && e) {
          let iters = this.findIter(s)
          let itere = this.findIter(e)
          if (flag.indexOf('L') != -1) {
            ret.push({
              data: iter.data(),
              other: iter.other()
            })
          }
          while (iters.next() != itere) {
            ret.push({
              data: iter.data(),
              other: iter.other()
            })
          }
          if (flag.indexOf('R') != -1) {
            ret.push({
              data: iter.data(),
              other: iter.other()
            })
          }
        } else {
          ret = []
          exist = false
        }
      } catch (error) {
        exist = false
      }
      console.log(ret, exist, flag)
      return ret, exist
    }
    // return left like data from tree
    like(data) {
      let ret = [];
      let bound = this.lowerBound(data)
      ret.push({
        data: bound.data(),
        other: bound.other(),
      })
      while (bound.next() && 0 === bound.data().indexOf(data)) {
        ret.push({
          data: bound.data(),
          other: bound.other(),
        })
      }
      return ret
    }
  }

  /**
   * A tree iterator for tree
   */
  class Iterator {
    constructor(tree) {
      this._tree = tree;
      this._ancestors = [];
      this._cursor = null;
    }
    data() {
      return this._cursor !== null ? this._cursor.data : null;
    }
    other() {
      return this._cursor !== null ? this._cursor.other : null;
    }
    // if null-iterator, returns first node
    // otherwise, returns next node
    next() {
      if (this._cursor === null) {
        var root = this._tree._root;
        if (root !== null) {
          this._minNode(root);
        }
      } else {
        if (this._cursor.right === null) {
          // no greater node in subtree, go up to parent
          // if coming from a right child, continue up the stack
          var save;
          do {
            save = this._cursor;
            if (this._ancestors.length) {
              this._cursor = this._ancestors.pop();
            } else {
              this._cursor = null;
              break;
            }
          } while (this._cursor.right === save);
        } else {
          // get the next node from the subtree
          this._ancestors.push(this._cursor);
          this._minNode(this._cursor.right);
        }
      }
      // return this._cursor !== null ? this._cursor.data : null;
      return this.data()
    }
    // if null-iterator, returns last node
    // otherwise, returns previous node
    prev() {
      if (this._cursor === null) {
        var root = this._tree._root;
        if (root !== null) {
          this._maxNode(root);
        }
      } else {
        if (this._cursor.left === null) {
          var save;
          do {
            save = this._cursor;
            if (this._ancestors.length) {
              this._cursor = this._ancestors.pop();
            } else {
              this._cursor = null;
              break;
            }
          } while (this._cursor.left === save);
        } else {
          this._ancestors.push(this._cursor);
          this._maxNode(this._cursor.left);
        }
      }
      // return this._cursor !== null ? this._cursor.data : null;
      return this.data()
    }
    _minNode(start) {
      while (start.left !== null) {
        this._ancestors.push(start);
        start = start.left;
      }
      this._cursor = start;
    }
    _maxNode(start) {
      while (start.right !== null) {
        this._ancestors.push(start);
        start = start.right;
      }
      this._cursor = start;
    }
  }

  ////////////////////////////////////////////////BINTREE//////////////////////////////////////////

  /**
   * tree node
   */
  class Node {
    constructor(data, other) {
      this.data = data;
      this.other = other;
      this.left = null;
      this.right = null;
    }
    get_child(dir) {
      return dir ? this.right : this.left;
    }
    set_child(dir, val) {
      if (dir) {
        this.right = val;
      } else {
        this.left = val;
      }
    }
  }

  class BinTree extends TreeBase {
    constructor(name, type, comparator) {
      super(name, type, comparator);
      this._root = null;
      // this._comparator = comparator;
      this.size = 0;
    }
    // returns true if inserted, false if duplicate
    insert(data, other) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      if (this._root === null) {
        // empty tree
        this._root = new Node(data, other);
        this.size++;
        return true;
      }

      var dir = 0;

      // setup
      var p = null; // parent
      var node = this._root;

      // search down
      while (true) {
        if (node === null) {
          // insert new node at the bottom
          node = new Node(data, other);
          p.set_child(dir, node);
          this.size++;
          return true;
        }

        // stop if found
        if (this._comparator(node.data, data) === 0) {
          return false;
        }

        dir = this._comparator(node.data, data) < 0;

        // update helpers
        p = node;
        node = node.get_child(dir);
      }
    }
    // returns true if removed, false if not found
    remove(data) {
      if (this._root === null) {
        return false;
      }
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var head = new Node(undefined); // fake tree root
      var node = head;
      node.right = this._root;
      var p = null; // parent
      var found = null; // found item
      var dir = 1;

      while (node.get_child(dir) !== null) {
        p = node;
        node = node.get_child(dir);
        var cmp = this._comparator(data, node.data);
        dir = cmp > 0;

        if (cmp === 0) {
          found = node;
        }
      }

      if (found !== null) {
        found.data = node.data;
        p.set_child(p.right === node, node.get_child(node.left === null));

        this._root = head.right;
        this.size--;
        return true;
      } else {
        return false;
      }
    }
    // returns true if update, false if not found
    update(data, newdata, newother) {
      if (this.remove(data)) {
        return this.insert(newdata, newother);
      }
      return false;
    }
  }

  ////////////////////////////////////////////////RBTREE///////////////////////////////////////////

  function is_red(node) {
    return node !== null && node.red;
  }

  function single_rotate(root, dir) {
    var save = root.get_child(!dir);

    root.set_child(!dir, save.get_child(dir));
    save.set_child(dir, root);

    root.red = true;
    save.red = false;

    return save;
  }

  function double_rotate(root, dir) {
    root.set_child(!dir, single_rotate(root.get_child(!dir), !dir));
    return single_rotate(root, dir);
  }

  /**
   * rbtree node
   */
  class rbNode {
    constructor(data, other) {
      this.data = data;
      this.other = other;
      this.left = null;
      this.right = null;
      this.red = true;
    }
    get_child(dir) {
      return dir ? this.right : this.left;
    }
    set_child(dir, val) {
      if (dir) {
        this.right = val;
      } else {
        this.left = val;
      }
    }
  }

  /**
   * red-black tree
   */
  class RBTree extends TreeBase {
    constructor(name, type, comparator) {
      super(name, type, comparator);
      this._root = null;
      // this._comparator = comparator;
      this.size = 0;
    }
    // returns true if inserted, false if duplicate
    insert(data, other) {
      if (!this._comparator) {
        this._comparator = gen_comparator(data)
      }
      var ret = false;

      if (this._root === null) {
        // empty tree
        this._root = new rbNode(data, other);
        ret = true;
        this.size++;
      } else {
        var head = new rbNode(undefined); // fake tree root

        var dir = 0;
        var last = 0;

        // setup
        var gp = null; // grandparent
        var ggp = head; // grand-grand-parent
        var p = null; // parent
        var node = this._root;
        ggp.right = this._root;

        // search down
        while (true) {
          if (node === null) {
            // insert new node at the bottom
            node = new rbNode(data, other);
            p.set_child(dir, node);
            ret = true;
            this.size++;
          } else if (is_red(node.left) && is_red(node.right)) {
            // color flip
            node.red = true;
            node.left.red = false;
            node.right.red = false;
          }

          // fix red violation
          if (is_red(node) && is_red(p)) {
            var dir2 = ggp.right === gp;

            if (node === p.get_child(last)) {
              ggp.set_child(dir2, single_rotate(gp, !last));
            } else {
              ggp.set_child(dir2, double_rotate(gp, !last));
            }
          }

          var cmp = this._comparator(node.data, data);

          // stop if found
          if (cmp === 0) {
            break;
          }

          last = dir;
          dir = cmp < 0;

          // update helpers
          if (gp !== null) {
            ggp = gp;
          }
          gp = p;
          p = node;
          node = node.get_child(dir);
        }

        // update root
        this._root = head.right;
      }

      // make root black
      this._root.red = false;

      return ret;
    }
    // returns true if removed, false if not found
    remove(data) {
      if (this._root === null) {
        return false;
      }

      var head = new rbNode(undefined); // fake tree root
      var node = head;
      node.right = this._root;
      var p = null; // parent
      var gp = null; // grand parent
      var found = null; // found item
      var dir = 1;

      while (node.get_child(dir) !== null) {
        var last = dir;

        // update helpers
        gp = p;
        p = node;
        node = node.get_child(dir);

        var cmp = this._comparator(data, node.data);

        dir = cmp > 0;

        // save found node
        if (cmp === 0) {
          found = node;
        }

        // push the red node down
        if (!is_red(node) && !is_red(node.get_child(dir))) {
          if (is_red(node.get_child(!dir))) {
            var sr = single_rotate(node, dir);
            p.set_child(last, sr);
            p = sr;
          } else if (!is_red(node.get_child(!dir))) {
            var sibling = p.get_child(!last);
            if (sibling !== null) {
              if (!is_red(sibling.get_child(!last)) && !is_red(sibling.get_child(last))) {
                // color flip
                p.red = false;
                sibling.red = true;
                node.red = true;
              } else {
                var dir2 = gp.right === p;

                if (is_red(sibling.get_child(last))) {
                  gp.set_child(dir2, double_rotate(p, last));
                } else if (is_red(sibling.get_child(!last))) {
                  gp.set_child(dir2, single_rotate(p, last));
                }

                // ensure correct coloring
                var gpc = gp.get_child(dir2);
                gpc.red = true;
                node.red = true;
                gpc.left.red = false;
                gpc.right.red = false;
              }
            }
          }
        }
      }

      // replace and remove if found
      if (found !== null) {
        found.data = node.data;
        p.set_child(p.right === node, node.get_child(node.left === null));
        this.size--;
      }

      // update root and make it black
      this._root = head.right;
      if (this._root !== null) {
        this._root.red = false;
      }

      return found !== null;
    }
    // returns true if update, false if not found
    update(data, newdata, newother) {
      if (this.remove(data)) {
        return this.insert(newdata, newother);
      }
      return false;
    }
  }

  function testBinTree() {
    var tree = new BinTree();
    tree.insert("I");
    tree.insert("Love");
    tree.insert("Love1");
    tree.insert("Love14");
    tree.insert("hello");
    tree.insert("bintree");
    tree.insert("China");
    // treval
    console.log('-----------bintree treval------------')
    tree.each(function (d) {
      console.log(d);
    });
    tree.range() // 全量遍历
    tree.range("Love") // 存在且只有起点
    tree.range("Love", null, "L") // 存在且只有起点（包括起点）
    tree.range(null, "Love") // 存在且只有终点
    tree.range(null, "Love", "R") // 存在且只有终点（包括终点）
    tree.range("a") // 不存在且只有起点
    tree.range(null, "a") // 不存在且只有终点
    tree.range("a", "b") // 不存在起点终点
    console.log('---------bintree range get-----------')
    let it = tree.findIter("Love")
    console.log('start: ', it.data())
    while (it.next()) {
      console.log(it.data())
    }
    console.log('---------bintree like get-----------')
    let likeret = tree.like("Love")
    console.log('like: ', likeret)
  }

  function testRBTree() {
    var tree = new RBTree();
    tree.insert("rbtree");
    tree.insert("I");
    tree.insert("Love");
    tree.insert("Love");
    tree.insert("Love1");
    tree.insert("Love14");
    tree.insert("hello");
    tree.insert("China");
    console.log('-----------rbtree treval------------')
    tree.each(function (d) {
      console.log(d);
    });
    tree.range() // 全量遍历
    tree.range("I") // 存在且只有起点
    tree.range("I", null, "L") // 存在且只有起点（包括起点）
    tree.range(null, "I") // 存在且只有终点
    tree.range(null, "I", "R") // 存在且只有终点（包括终点）
    tree.range("a") // 不存在且只有起点
    tree.range(null, "a") // 不存在且只有终点
    tree.range("a", "b") // 不存在起点终点
    console.log('---------rbtree range get-----------')
    let it = tree.findIter("I")
    console.log('start: ', it.data())
    while (it.next()) {
      console.log(it.data())
    }
    console.log('---------rbtree like get-----------')
    let likeret = tree.like("Chi")
    console.log('like: ', likeret)
  }

  exports.RBTree = RBTree;
  exports.rbNode = rbNode;
  exports.BinTree = BinTree;
  exports.testRBTree = testRBTree;
  exports.testBinTree = testBinTree;
});