'use strict';

const request = require('request');
const qs = require('querystring');

const Aigle = require('aigle');

const HOST = 'https://api.github.com/';

Object.assign(exports, {
  get
});

/**
 * @param {string} query - search/users or search/repositories
 * @param {string} token - github auth token
 * @param {Object} opts
 * @param {string} opts.q
 * @param {integer} [opts.page=1]
 * @param {Enum} [opts.sort] - [undefined, 'followers', 'repositories', 'joined']
 * @param {Enum} [opts.order=desc] - ['asc', 'desc']
 */
function get(query, token, opts) {
  const {
    q,
    page = 1,
    sort,
    order = 'desc'
  } = opts || {};
  if (!query) {
    return Aigle.reject(new Error('Invalid query'));
  }
  if (!token) {
    return Aigle.reject(new Error('Invalid token'));
  }
  if (!q) {
    return Aigle.reject(new Error('Invalid q'));
  }
  const result = [];
  const str = qs.stringify({
    q,
    sort,
    order,
    page,
    access_token: token
  });
  const url = `${HOST}${query}?${str}`;
  const options = {
    url,
    headers: {
      'User-Agent': 'made-in-generator'
    }
  };
  return new Aigle((resolve, reject) => {
    request(options, (err, res, body) => {
      body = body && JSON.parse(body);
      if (err || res.statusCode !== 200) {
        return reject(err || body.message);
      }
      const { items } = body;
      result.push(...items);
      resolve(items);
    });
  });
}
