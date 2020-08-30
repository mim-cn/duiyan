/*
	Tks Kailash Nadh (http://nadh.in)

	localStorageDB v 2.3.1
	A simple database layer for localStorage
*/

(function (g, f) {
  const e = typeof exports == 'object' ? exports : typeof g == 'object' ? g : {};
  f(e);
  if (typeof define == 'function' && define.amd) {
    define('dber', e);
  }
})(this, function (exports) {

  const lzw = require('../common/lzw')
  const indexTree = require('./tree').RBTree
  const indexNode = require('./tree').rbNode

  class Dber {
    constructor(db_name, engine) {
      let self = this
      this.db_prefix = 'db_'
      this.db_id = this.db_prefix + db_name
      this.db_new = false // this flag determines whether a new database was created during an object initialisation
      this.db = null
      if ("string" != typeof engine || 0 == engine.length) {
        engine = "wxStorage"
      }
      this.engine = engine
      // if the database doesn't exist, create it
      this.db = this._getEngine()
      // this.ctx = JSON.parse(this.db)
      // console.log(JSON.parse(this.db))
      if (!(this.db && (this.db = JSON.parse(this.db, function (key, value) {
        self.__dataReviver(this, value)
      })) && this.db.tables && this.db.data)) {
        if (!this._validateName(db_name)) {
          this._error("The name '" + db_name + "' contains invalid characters");
        } else {
          this.db = {
            tables: {},
            data: {},
            indexes: {},
          };
          this._load(this.db_id).then(res => {
            console.log(res)
          }).catch(e => {
            console.log(e)
          })
          this.commit();
          this.db_new = true;
        }
      } else {
        console.log(this.db)
      }

    }

    // 还原原型链
    __dataReviver(self, value) {
      // console.log(ctx, self, key, value)
      // 判断是树，还原原型链
      if (Object.keys(new indexTree()).toString() === Object.keys(self).toString()) {
        self.__proto__ = indexTree.prototype
      }
      // 判断是节点，还原原型链
      if (Object.keys(new indexNode()).toString() === Object.keys(self).toString()) {
        self.__proto__ = indexNode.prototype
      }
      return value
    }

    // private methods

    // get engine localStorage, sessionStorage, wxStorage
    _getEngine() {
      switch (this.engine) {
        case 'localStorage':
          return localStorage[this.db_id];
        case 'sessionStorage':
          return sessionStorage[this.db_id];
        case 'wxStorage':
          return wx.getStorageSync(this.db_id);
        default:
          return wx.getStorageSync(this.db_id);
      }
    }

    // database functions
    // drop the database from localStorage, sessionStorage, wxStorage
    _drop() {
      switch (this.engine) {
        case 'localStorage':
          if (localStorage.hasOwnProperty(this.db_id)) {
            delete localStorage[this.db_id];
          }
          break;
        case 'sessionStorage':
          if (sessionStorage.hasOwnProperty(this.db_id)) {
            delete sessionStorage[this.db_id];
          }
          break;
        case 'wxStorage':
          wx.removeStorage({
            key: this.db_id,
          })
          break;
        default:
          wx.removeStorage({
            key: this.db_id,
          })
          break;
      }
      this.db = null;
    }

    // commit the database to localStorage, sessionStorage, wxStorage
    _commit() {
      try {
        switch (this.engine) {
          case 'localStorage':
            localStorage.setItem(this.db_id, JSON.stringify(this.db));
            break;
          case 'sessionStorage':
            sessionStorage.setItem(this.db_id, JSON.stringify(this.db));
            break;
          case 'wxStorage':
            wx.setStorage({
              data: JSON.stringify(this.db),
              key: this.db_id,
            })
            break;
          default:
            wx.setStorage({
              data: JSON.stringify(this.db),
              key: this.db_id,
            })
            break;
        }
        return true;
      } catch (e) {
        return false;
      }
    }

    // number of tables in the database
    _tableCount() {
      var count = 0;
      for (var table in this.db.tables) {
        if (this.db.tables.hasOwnProperty(table)) {
          count++;
        }
      }
      return count;
    }

    //  table functions

    // returns all fields in a table.
    _tableFields(table_name) {
      return this.db.tables[table_name].fields;
    }

    // check whether a table exists
    _tableExists(table_name) {
      return this.db.tables[table_name] ? true : false;
    }

    // check whether a table exists, and if not, throw an error
    _tableExistsWarn(table_name) {
      if (!this._tableExists(table_name)) {
        this._error("The table '" + table_name + "' does not exist");
      }
    }

    // check whether a table column exists
    _columnExists(table_name, field_name) {
      var exists = false;
      var table_fields = this.db.tables[table_name].fields;
      for (var field in table_fields) {
        if (table_fields[field] == field_name) {
          exists = true;
          break;
        }
      }
      return exists;
    }

    // create a table
    _createTable(table_name, fields, indexfields) {
      this.db.tables[table_name] = {
        fields: fields,
        auto_increment: 1
      };
      this.db.data[table_name] = {};
      this.db.indexes[table_name] = {};
      for (var i = 0, len = indexfields.length; i < len; i++) {
        let {
          indexfield,
          type
        } = this.__checkIndexType(indexfields[i])
        this.db.indexes[table_name][indexfield] = new indexTree(indexfield, type)
      }
    }

    // drop a table
    _dropTable(table_name) {
      delete this.db.tables[table_name];
      delete this.db.data[table_name];
    }

    // empty a table
    _truncate(table_name) {
      this.db.tables[table_name].auto_increment = 1;
      this.db.data[table_name] = {};
    }

    //alter a table
    _alterTable(table_name, new_fields, default_values) {
      this.db.tables[table_name].fields = this.db.tables[table_name].fields.concat(new_fields);

      // insert default values in existing table
      if (typeof default_values != "undefined") {
        // loop through all the records in the table
        for (var ID in this.db.data[table_name]) {
          if (!this.db.data[table_name].hasOwnProperty(ID)) {
            continue;
          }
          for (var field in new_fields) {
            if (typeof default_values == "object") {
              this.db.data[table_name][ID][new_fields[field]] = default_values[new_fields[field]];
            } else {
              this.db.data[table_name][ID][new_fields[field]] = default_values;
            }
          }
        }
      }
    }

    // number of rows in a table
    _rowCount(table_name) {
      var count = 0;
      for (var ID in this.db.data[table_name]) {
        if (this.db.data[table_name].hasOwnProperty(ID)) {
          count++;
        }
      }
      return count;
    }

    // add a table index
    __addIndexes(table_name, ifield, data, id) {
      data = data.toLowerCase()
      let index = this._indexes(table_name, ifield)
      if (indexTree.prototype.isPrototypeOf(index)) {
        let exist = this._indexes(table_name, ifield).find(data)
        if (exist) {
          if (index.type == "UNIQUE") {
            this._error("Duplicate entry ‘" + data + "’ for key ‘UNIQUE’")
          }
          let other = (exist.other).push(id)
          // 由于是引用，无需再次操作indexTree
          // this._indexes(table_name, ifield).insert(data, other)
        } else {
          this._indexes(table_name, ifield).insert(data, [id])
        }
      } else {
        console.error("indexes is invalid" + table_name + "." + ifield)
      }
    }

    // del a table index
    __delIndexes(table_name, ifield, data, id) {
      data = data.toLowerCase()
      let index = this._indexes(table_name, ifield)
      if (indexTree.prototype.isPrototypeOf(index)) {
        let exist = this._indexes(table_name, ifield).find(data)
        if (exist) {
          if (exist.other.length > 1) {
            exist.other = (exist.other).filter(d => d != id);
            // 由于是引用，无需再次操作indexTree
            // this._indexes(table_name, ifield).insert(data, exist.other)
          } else {
            this._indexes(table_name, ifield).remove(data)
          }
        }
      } else {
        console.error("indexes is invalid" + table_name + "." + ifield)
      }
    }

    // update a table index
    __updateIndexes(table_name, ifield, old_data, new_data, ids) {
      old_data = old_data.toLowerCase()
      new_data = new_data.toLowerCase()
      let index = this._indexes(table_name, ifield)
      if (indexTree.prototype.isPrototypeOf(index)) {
        let exist = this._indexes(table_name, ifield).find(old_data)
        if (exist) {
          // 删除老的数据索引，新增新的数据索引
          this._indexes(table_name, ifield).update(data, new_data, ids)
        }
      } else {
        console.error("indexes is invalid" + table_name + "." + ifield)
      }
    }

    // check index field type
    __checkIndexType(indexfield) {
      let type = indexfield[0]
      switch (type) {
        case '@':
          type = 'UNIQUE';
          indexfield = indexfield.slice(1)
          break
        case '#':
          type = 'INDEX';
          indexfield = indexfield.slice(1)
          break;
        default:
          type = 'INDEX';
          break;
      }
      return {
        indexfield,
        type
      }
    }

    // indexes
    _indexes(table_name, ifield) {
      return ifield ? this.db.indexes[table_name][ifield] : this.db.indexes[table_name]
    }

    // insert a new row
    _insert(table_name, data) {
      data.ID = this.db.tables[table_name].auto_increment;
      this.db.data[table_name][this.db.tables[table_name].auto_increment] = data;
      // add indexes
      for (var ifield in this._indexes(table_name)) {
        if (data[ifield]) {
          this.__addIndexes(table_name, ifield, data[ifield], this.db.tables[table_name].auto_increment)
          // this._indexes(table_name, ifield).insert(data[ifield], this.db.tables[table_name].auto_increment)
        }
      }
      this.db.tables[table_name].auto_increment++;
      return data.ID;
    }

    // select rows, given a list of IDs of rows in a table
    _select(table_name, ids, start, limit, sort, distinct) {
      var ID = null,
        results = [],
        row = null;

      for (var i = 0; i < ids.length; i++) {
        ID = ids[i];
        row = this.db.data[table_name][ID];
        results.push(this._clone(row));
      }

      // there are sorting params
      if (sort && sort instanceof Array) {
        for (var i = 0; i < sort.length; i++) {
          results.sort(this._sort_results(sort[i][0], sort[i].length > 1 ? sort[i][1] : null));
        }
      }

      // distinct params
      if (distinct && distinct instanceof Array) {
        for (var j = 0; j < distinct.length; j++) {
          var seen = {},
            d = distinct[j];

          for (var i = 0; i < results.length; i++) {
            if (results[i] === undefined) {
              continue;
            }

            if (results[i].hasOwnProperty(d) && seen.hasOwnProperty(results[i][d])) {
              delete (results[i]);
            } else {
              seen[results[i][d]] = 1;
            }
          }
        }

        // can't use .filter(ie8)
        var new_results = [];
        for (var i = 0; i < results.length; i++) {
          if (results[i] !== undefined) {
            new_results.push(results[i]);
          }
        }

        results = new_results;
      }

      // limit and offset
      start = start && typeof start === "number" ? start : null;
      limit = limit && typeof limit === "number" ? limit : null;

      if (start && limit) {
        results = results.slice(start, start + limit);
      } else if (start) {
        results = results.slice(start);
      } else if (limit) {
        results = results.slice(start, limit);
      }
      // console.log(results)
      return results;
    }

    // sort a result set
    _sort_results(field, order) {
      return function (x, y) {
        // case insensitive comparison for string values
        var v1 = typeof (x[field]) === "string" ? x[field].toLowerCase() : x[field],
          v2 = typeof (y[field]) === "string" ? y[field].toLowerCase() : y[field];

        if (order === "DESC") {
          return v1 == v2 ? 0 : (v1 < v2 ? 1 : -1);
        } else {
          return v1 == v2 ? 0 : (v1 > v2 ? 1 : -1);
        }
      };
    }

    // select rows in a table by field-value pairs, returns the IDs of matches
    _queryByValues(table_name, data) {
      var result_ids = [],
        exists = false,
        row = null;

      // loop through all the records in the table, looking for matches
      for (var ID in this.db.data[table_name]) {
        if (!this.db.data[table_name].hasOwnProperty(ID)) {
          continue;
        }

        row = this.db.data[table_name][ID];
        exists = true;

        for (var field in data) {
          if (!data.hasOwnProperty(field)) {
            continue;
          }

          if (typeof data[field] == 'string') { // if the field is a string, do a case insensitive comparison
            if (row[field].toString().toLowerCase() != data[field].toString().toLowerCase()) {
              exists = false;
              break;
            }
          } else {
            if (row[field] != data[field]) {
              exists = false;
              break;
            }
          }
        }
        if (exists) {
          result_ids.push(ID);
        }
      }

      return result_ids;
    }

    // select rows in a table by a function, returns the IDs of matches
    _queryByFunction(table_name, query_function) {
      var result_ids = [],
        row = null;

      // loop through all the records in the table, looking for matches
      for (var ID in this.db.data[table_name]) {
        if (!this.db.data[table_name].hasOwnProperty(ID)) {
          continue;
        }

        row = this.db.data[table_name][ID];

        if (query_function(this._clone(row)) == true) { // it's a match if the supplied conditional function is satisfied
          result_ids.push(ID);
        }
      }

      return result_ids;
    }

    // return all the IDs in a table
    _getIDs(table_name) {
      var result_ids = [];

      for (var ID in this.db.data[table_name]) {
        if (this.db.data[table_name].hasOwnProperty(ID)) {
          result_ids.push(ID);
        }
      }
      return result_ids;
    }

    // delete rows, given a list of their IDs in a table
    _deleteRows(table_name, ids) {
      for (var i = 0; i < ids.length; i++) {
        if (this.db.data[table_name].hasOwnProperty(ids[i])) {
          // remove indexes
          let del_data = this.db.data[table_name][ids[i]]
          for (var ifield in this._indexes(table_name)) {
            this.__delIndexes(table_name, ifield, del_data[ifield], ids[i]);
            // this._indexes(table_name, ifield).remove(del_data[ifield])
          }
          delete this.db.data[table_name][ids[i]];
        }
      }
      return ids.length;
    }

    // update rows
    _update(table_name, ids, update_function) {
      var ID = '',
        num = 0;

      // 记录更新的索引字段
      let update_ifield = {}
      for (var i = 0; i < ids.length; i++) {
        ID = ids[i];

        var updated_data = update_function(this._clone(this.db.data[table_name][ID]));

        if (updated_data) {
          delete updated_data['ID']; // no updates possible to ID

          let old_data = this.db.data[table_name][ID]
          var new_data = this._clone(old_data);
          // merge updated data with existing data
          for (var field in updated_data) {
            if (updated_data.hasOwnProperty(field)) {
              new_data[field] = updated_data[field];
            }
            // 是索引字段，且数据发生变化，才更新索引
            if (this._indexes(table_name, field) && new_data[field] !== old_data[field]) {
              update_ifield[field] = update_ifield[field] || {}
              update_ifield[field].old = (update_ifield[field].old || [])
              update_ifield[field].old.push(old_data[field])
              update_ifield[field].new = (update_ifield[field].new || [])
              update_ifield[field].new.push(new_data[field])
              update_ifield[field].ids = (update_ifield[field].ids || [])
              update_ifield[field].ids.push(ID)
            }
          }
          this.db.data[table_name][ID] = this._validFields(table_name, new_data);
          num++;
        }
      }
      // update indexes
      for (var ifield in update_ifield) {
        for (var i in update_ifield[ifield].old) {
          this.__delIndexes(table_name, ifield, update_ifield[ifield].old[i], update_ifield[ifield].ids[i])
          this.__addIndexes(table_name, ifield, update_ifield[ifield].new[i], update_ifield[ifield].ids[i])
        }
      }
      return num;
    }

    // serialize the database
    _serialize(data) {
      return JSON.stringify(data || this.db);
    }

    // throw an error
    _error(msg) {
      throw new Error(msg);
    }

    // clone an object
    _clone(obj) {
      var new_obj = {};
      for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
          new_obj[key] = obj[key];
        }
      }
      return new_obj;
    }

    // validate db, table, field names (alpha-numeric only)
    _validateName(name) {
      return name.toString().match(/[^a-z_0-9#@]/ig) ? false : true;
    }

    // given a data list, only retain valid fields in a table
    _validFields(table_name, data) {
      var field = '',
        new_data = {};

      for (var i = 0; i < this.db.tables[table_name].fields.length; i++) {
        field = this.db.tables[table_name].fields[i];

        if (data[field] !== undefined) {
          new_data[field] = data[field];
        }
      }
      return new_data;
    }

    // given a data list, populate with valid field names of a table
    _validateData(table_name, data) {
      var field = '',
        new_data = {};
      for (var i = 0; i < this.db.tables[table_name].fields.length; i++) {
        field = this.db.tables[table_name].fields[i];
        new_data[field] = (data[field] === null || data[field] === undefined) ? null : data[field];
      }
      return new_data;
    }

    // dump database data
    /**
     * {Boolean} flag: false 表示不压缩，默认true
     */
    _dump(flag) {
      const FileSystemManager = wx.getFileSystemManager()
      // dump data
      let db_path = (this.db_id || 'tmp') + '_db.dat'
      let metadata_path = (this.db_id || 'tmp') + '_metadb.dat'
      let dbdata = [db_path, this._serialize(this.db.data)]
      let metadata = [metadata_path, this._serialize(this.db.tables)]
      return Promise.all([dbdata, metadata].map((item) => {
        return new Promise(function (resolve, reject) {
          FileSystemManager.writeFile({
            filePath: wx.env.USER_DATA_PATH + '/' + item[0],
            encoding: 'utf-8',
            data: (false == flag) ? item[1] : lzw.compress(item[1]),
            success: function (res) {
              res.path = wx.env.USER_DATA_PATH + '/' + item[0]
              resolve(res)
            },
            fail: function (err) {
              reject(err)
            }
          })
        });
      }));
    }

    // load database data
    _load(db_id) {
      const FileSystemManager = wx.getFileSystemManager()
      let db_path = (db_id || 'tmp') + '_db.dat'
      let metadata_path = (db_id || 'tmp') + '_metadb.dat'
      return Promise.all([db_path, metadata_path].map((path) => {
        return new Promise(function (resolve, reject) {
          FileSystemManager.readFile({
            filePath: wx.env.USER_DATA_PATH + '/' + path,
            encoding: 'utf-8',
            success: function (res) {
              // console.log(res.data)
              let rts = lzw.decompress(res.data)
              resolve([wx.env.USER_DATA_PATH + '/' + path, JSON.parse(rts)])
            },
            fail: function (err) {
              // console.log('读取失败', err)
              reject(err)
            }
          })
        });
      }));
    }

    // get data by ids
    _getDataByIDs(table_name, ids) {
      return (ids || []).map(ID => {
        return this.db.data[table_name][ID]
      });
    }
    // getDataByIndex
    _getDataByIndex(table_name, ifield, indexdata) {
      let index = this._indexes(table_name, ifield).findIter(indexdata)
      return this._getDataByIDs(table_name, index.other())
    }
    // travel indexes
    travelIndex(table_name) {
      let self = this
      let table_indexes = this._indexes(table_name) || {}
      for (let index in table_indexes) {
        table_indexes[index].each(function (d, o) {
          console.log(d, self._getDataByIDs(table_name, o))
        })
      }
    }

    // commit the database to localStorage
    commit() {
      return this._commit();
    }

    // is this instance a newly created database?
    isNew() {
      return this.db_new;
    }

    // delete the database
    drop() {
      this._drop();
    }

    // serialize the database
    serialize(data) {
      return this._serialize(data);
    }

    // check whether a table exists
    tableExists(table_name) {
      return this._tableExists(table_name);
    }

    // list of keys in a table
    tableFields(table_name) {
      return this._tableFields(table_name);
    }

    // number of tables in the database
    tableCount() {
      return this._tableCount();
    }

    // col
    columnExists(table_name, field_name) {
      return this._columnExists(table_name, field_name);
    }

    // create a table
    createTable(table_name, fields, indexfields) {
      var result = false;
      if (!this._validateName(table_name)) {
        this._error("The database name '" + table_name + "' contains invalid characters.");
      } else if (this.tableExists(table_name)) {
        this._error("The table name '" + table_name + "' already exists.");
      } else {
        // make sure field names are valid
        var is_valid = true;
        for (var i = 0; i < fields.length; i++) {
          if (!this._validateName(fields[i])) {
            is_valid = false;
            break;
          }
        }

        if (is_valid) {
          // cannot use indexOf due to <IE9 incompatibility
          // de-duplicate the field list
          var fields_literal = {};
          for (var i = 0, len = fields.length; i < len; i++) {
            fields_literal[fields[i]] = true;
          }
          delete fields_literal['ID']; // ID is a reserved field name

          fields = ['ID'];
          let fields_tb = {}
          for (var field in fields_literal) {
            if (fields_literal.hasOwnProperty(field)) {
              fields_tb[field] = 1
              fields.push(field);
            }
          }
          // index fields 
          let indexfields2 = (indexfields || [])
          indexfields = []
          for (var i = 0, len = indexfields2.length; i < len; i++) {
            let {
              indexfield
            } = this.__checkIndexType(indexfields2[i])
            if (1 === fields_tb[indexfield]) {
              indexfields.push(indexfields2[i]);
            }
          }
          this._createTable(table_name, fields, indexfields);
          result = true;
        } else {
          this._error("One or more field names in the table definition contains invalid characters");
        }
      }

      return result;
    }

    // Create a table using array of Objects @ [{k:v,k:v},{k:v,k:v},etc]
    createTableWithData(table_name, data, indexfields) {
      if (typeof data !== 'object' || !data.length || data.length < 1) {
        this._error("Data supplied isn't in object form. Example: [{k:v,k:v},{k:v,k:v} ..]");
      }

      var fields = Object.keys(data[0]);

      // create the table
      if (this.createTable(table_name, fields, indexfields)) {
        this.commit();

        // populate
        for (var i = 0; i < data.length; i++) {
          if (!this.insert(table_name, data[i])) {
            this._error("Failed to insert record: [" + JSON.stringify(data[i]) + "]");
          }
        }
        this.commit();
      }
      return true;
    }

    // drop a table
    dropTable(table_name) {
      this._tableExistsWarn(table_name);
      this._dropTable(table_name);
    }

    // empty a table
    truncate(table_name) {
      this._tableExistsWarn(table_name);
      this._truncate(table_name);
    }

    // alter a table
    alterTable(table_name, new_fields, default_values) {
      var result = false;
      if (!this._validateName(table_name)) {
        this._error("The database name '" + table_name + "' contains invalid characters");
      } else {
        if (typeof new_fields == "object") {
          // make sure field names are valid
          var is_valid = true;
          for (var i = 0; i < new_fields.length; i++) {
            if (!this._validateName(new_fields[i])) {
              is_valid = false;
              break;
            }
          }

          if (is_valid) {
            // cannot use indexOf due to <IE9 incompatibility
            // de-duplicate the field list
            var fields_literal = {};
            for (var i = 0; i < new_fields.length; i++) {
              fields_literal[new_fields[i]] = true;
            }
            delete fields_literal['ID']; // ID is a reserved field name

            new_fields = [];
            for (var field in fields_literal) {
              if (fields_literal.hasOwnProperty(field)) {
                new_fields.push(field);
              }
            }

            this._alterTable(table_name, new_fields, default_values);
            result = true;
          } else {
            this._error("One or more field names in the table definition contains invalid characters");
          }
        } else if (typeof new_fields == "string") {
          if (this._validateName(new_fields)) {
            var new_fields_array = [];
            new_fields_array.push(new_fields);
            this._alterTable(table_name, new_fields_array, default_values);
            result = true;
          } else {
            this._error("One or more field names in the table definition contains invalid characters");
          }
        }
      }

      return result;
    }

    // number of rows in a table
    rowCount(table_name) {
      this._tableExistsWarn(table_name);
      return this._rowCount(table_name);
    }

    // insert a row
    insert(table_name, data) {
      this._tableExistsWarn(table_name);
      return this._insert(table_name, this._validateData(table_name, data));
    }

    // insert or update based on a given condition
    insertOrUpdate(table_name, query, data) {
      this._tableExistsWarn(table_name);

      var result_ids = [];
      if (!query) {
        result_ids = this._getIDs(table_name); // there is no query. applies to all records
      } else if (typeof query == 'object') { // the query has key-value pairs provided
        result_ids = this._queryByValues(table_name, this._validFields(table_name, query));
      } else if (typeof query == 'function') { // the query has a conditional map function provided
        result_ids = this._queryByFunction(table_name, query);
      }

      // no existing records matched, so insert a new row
      if (result_ids.length == 0) {
        return this.insert(table_name, this._validateData(table_name, data));
      } else {
        var ids = [];
        for (var n = 0; n < result_ids.length; n++) {
          this._update(table_name, result_ids, function (o) {
            ids.push(o.ID);
            return data;
          });
        }

        return ids;
      }
    }

    // update rows
    update(table_name, query, update_function) {
      this._tableExistsWarn(table_name);

      var result_ids = [];
      if (!query) {
        result_ids = this._getIDs(table_name); // there is no query. applies to all records
      } else if (typeof query == 'object') { // the query has key-value pairs provided
        result_ids = this._queryByValues(table_name, this._validFields(table_name, query));
      } else if (typeof query == 'function') { // the query has a conditional map function provided
        result_ids = this._queryByFunction(table_name, query);
      }
      return this._update(table_name, result_ids, update_function);
    }

    // select rows
    query(table_name, query, limit, start, sort, distinct) {
      this._tableExistsWarn(table_name);

      var result_ids = [];
      if (!query) {
        result_ids = this._getIDs(table_name, limit, start); // no conditions given, return all records
      } else if (typeof query == 'object') { // the query has key-value pairs provided
        result_ids = this._queryByValues(table_name, this._validFields(table_name, query), limit, start);
      } else if (typeof query == 'function') { // the query has a conditional map function provided
        result_ids = this._queryByFunction(table_name, query, limit, start);
      }

      return this._select(table_name, result_ids, start, limit, sort, distinct);
    }

    // alias for query() that takes a dict of params instead of positional arrguments
    queryAll(table_name, params) {
      if (!params) {
        return this.query(table_name)
      } else {
        return this.query(table_name,
          params.hasOwnProperty('query') ? params.query : null,
          params.hasOwnProperty('limit') ? params.limit : null,
          params.hasOwnProperty('start') ? params.start : null,
          params.hasOwnProperty('sort') ? params.sort : null,
          params.hasOwnProperty('distinct') ? params.distinct : null
        );
      }
    }

    // delete rows
    deleteRows(table_name, query) {
      this._tableExistsWarn(table_name);

      var result_ids = [];
      if (!query) {
        result_ids = this._getIDs(table_name);
      } else if (typeof query == 'object') {
        result_ids = this._queryByValues(table_name, this._validFields(table_name, query));
      } else if (typeof query == 'function') {
        result_ids = this._queryByFunction(table_name, query);
      }
      return this._deleteRows(table_name, result_ids);
    }
  }

  function getTestDB() {
    // Initialise. If the database doesn't exist, it is created
    var db = new Dber("library");

    // Check if the database was just created. Useful for initial database setup
    if (db.isNew()) {
      // create the "books" table
      db.createTable("books", ["code", "title", "author", "year", "copies"], ["code", "author"]);
      // insert some data
      db.insert("books", {
        code: "B001",
        title: "Phantoms in the brain",
        author: "Ramachandran",
        year: 1999,
        copies: 10
      });
      db.insert("books", {
        code: "B002",
        title: "The tell-tale brain",
        author: "Ramachandran",
        year: 2011,
        copies: 10
      });
      db.insert("books", {
        code: "B003",
        title: "Freakonomics",
        author: "Levitt and Dubner",
        year: 2005,
        copies: 10
      });
      db.insert("books", {
        code: "B004",
        title: "Predictably irrational",
        author: "Ariely",
        year: 2008,
        copies: 10
      });
      db.insert("books", {
        code: "B004",
        title: "Predictably irrational2",
        author: "Ariely2",
        year: 2008,
        copies: 10
      });
      db.insert("books", {
        code: "B005",
        title: "Tesla: Man out of time",
        author: "Cheney",
        year: 2001,
        copies: 10
      });
      db.insert("books", {
        code: "B006",
        title: "Salmon fishing in the Yemen",
        author: "Torday",
        year: 2007,
        copies: 10
      });
      db.insert("books", {
        code: "B007",
        title: "The user illusion",
        author: "Norretranders",
        year: 1999,
        copies: 10
      });
      db.insert("books", {
        code: "B008",
        title: "Hubble: Window of the universe",
        author: "Sparrow",
        year: 2010,
        copies: 10
      });
      db.insert("books", {
        code: "B009",
        title: "Hubble: Window of the universe",
        author: "Ramachandran",
        year: 1999,
        copies: 10
      });

      // commit the database to localStorage
      // all create/drop/insert/update/delete operations should be committed
      db.commit();
    }
    // If database already exists, and want to alter existing tables
    if (!(db.columnExists("books", "publication"))) {
      db.alterTable("books", "publication", "McGraw-Hill Education");
      db.commit(); // commit the deletions to localStorage
    }

    // Multiple columns can also added at once
    if (!(db.columnExists("books", "publication") && db.columnExists("books", "ISBN"))) {
      db.alterTable("books", ["publication", "ISBN"], {
        publication: "McGraw-Hill Education",
        ISBN: "85-359-0277-5"
      });
      db.commit(); // commit the deletions to localStorage
    }

    // simple select queries
    db.queryAll("books", {
      query: {
        year: 2011
      }
    });
    db.queryAll("books", {
      query: {
        year: 1999,
        author: "Norretranders"
      }
    });

    // select all books
    db.queryAll("books");

    // select all books published after 2003
    db.queryAll("books", {
      query: function (row) { // the callback function is applied to every row in the table
        if (row.year > 2003) { // if it returns true, the row is selected
          return true;
        } else {
          return false;
        }
      }
    });

    // select all books by Torday and Sparrow
    db.queryAll("books", {
      query: function (row) {
        if (row.author == "Torday" || row.author == "Sparrow") {
          return true;
        } else {
          return false;
        }
      },
      limit: 5
    });

    // select 5 rows sorted in ascending order by author
    db.queryAll("books", {
      limit: 5,
      sort: [
        ["author", "ASC"]
      ]
    });

    // select all rows first sorted in ascending order by author, and then, in descending, by year
    db.queryAll("books", {
      sort: [
        ["author", "ASC"],
        ["year", "DESC"]
      ]
    });

    db.queryAll("books", {
      query: {
        "year": 2011
      },
      limit: 5,
      sort: [
        ["author", "ASC"]
      ]
    });

    // or using query()'s positional arguments, which is a little messy (DEPRECATED)
    db.query("books", null, null, null, [
      ["author", "ASC"]
    ]);
    db.queryAll("books", {
      distinct: ["year", "author"]
    });
    // query results are returned as arrays of object literals
    // an ID field with the internal auto-incremented id of the row is also included
    // thus, ID is a reserved field name

    let d = db.queryAll("books", {
      query: {
        author: "ramachandran"
      }
    });
    let indexD = db._getDataByIndex("books", "author", "ramachandran")
    /* results
    [
     {
       ID: 1,
       code: "B001",
       title: "Phantoms in the brain",
       author: "Ramachandran",
       year: 1999,
       copies: 10
     },
     {
       ID: 2,
       code: "B002",
       title: "The tell-tale brain",
       author: "Ramachandran",
       year: 2011,
       copies: 10
     }
    ]
    */
    // change the title of books published in 1999 to "Unknown"
    db.update("books", {
      year: 1999
    }, function (row) {
      row.author = "Unknown";

      // the update callback function returns to the modified record
      return row;
    });

    // add +5 copies to all books published after 2003
    db.update("books",
      function (row) { // select condition callback
        if (row.year > 2003) {
          return true;
        } else {
          return false;
        }
      },
      function (row) { // update function
        row.copies += 5;
        return row;
      }
    );
    // if there's a book with code B003, update it, or insert it as a new row
    db.insertOrUpdate("books", {
      code: 'B003'
    }, {
      code: "B003",
      title: "Freakonomics",
      author: "Levitt and Dubner",
      year: 2005,
      copies: 15
    });
    // delete all books published in 1999
    db.deleteRows("books", {
      year: 1999
    });

    // delete all books published before 2005
    db.deleteRows("books", function (row) {
      if (row.year < 2005) {
        return true;
      } else {
        return false;
      }
    });
    db.commit(); // commit the deletions to localStorage

    // // 1
    // let dress = await db._dump()
    // // 2
    // async function Dump() {
    //   await db._dump()
    // }
    // let dsress = Dump()
    // // 3

    db._dump().then(res => {
      console.log("dump ok:", res)
    }).catch(e => {
      console.log("dump fail:", e)
    })

    db._load(db.db_id).then(res => {
      console.log("load ok:", res)
    }).catch(e => {
      console.log(e)
    })

    db.travelIndex("books")
  }

  exports.Dber = Dber;
  exports.getTestDB = getTestDB;
});