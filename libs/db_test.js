const {
  Dber
} = require("./dber");

function getTestDB() {
  // Initialise. If the database doesn't exist, it is created
  var db = new Dber("library");

  // Check if the database was just created. Useful for initial database setup
  if (db.isNew()) {
    // create the "books" table
    db.createTable("books", ["code", "title", "author", "year", "copies"]);
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

  db.queryAll("books", {
    query: {
      author: "ramachandran"
    }
  });

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
    row.title = "Unknown";

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

  let lress = await db._load(db.db_id)
  db._load(db.db_id).then(res => {
    console.log("load ok:", res)
  }).catch(e => {
    console.log(e)
  })
}

module.exports = {
  getTestDB: getTestDB,
}