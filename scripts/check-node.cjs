if (Number(process.versions.node.split('.')[0]) !== 24) {
  console.error('This project requires Node.js 24 (SQLite native ABI).');
  process.exit(1);
}
const Database = require('better-sqlite3');
new Database(':memory:').close();
console.log('Node 24 SQLite runtime ready.');
