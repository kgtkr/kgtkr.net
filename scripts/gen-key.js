const crypto = require('crypto');

console.log(crypto.createHmac('sha256', process.env.DRAFT_MASTER_KEY).update(process.argv[2]).digest('hex'));