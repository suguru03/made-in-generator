'use strict';

const fs = require('fs');
const path = require('path');

const _  = require('lodash');
const Aigle = require('aigle');
const Github = require('gh.js');

const request = require('./request');

Aigle.promisifyAll(Github);
Aigle.config({ cancellation: true });

const { CancellationError } = Aigle;

const DELAY = 30 * 1000;
const LOWEST_STAR = 3;
const MAXIMUM_LENGTH = 30;

const filepath = _.transform([
  'rankers',
  'developers',
  'repositories'
], (result, key) => {
  result[key] = path.resolve(__dirname, '../../..', 'data', `${key}.json`);
}, {});

const query = {
  users: 'search/users',
  repositories: 'search/repositories'
};

class MadeIn {

  /**
   * @param {string|string[]} [opts.token]
   * @param {string[]} [opts.tokens]
   */
  constructor(opts) {
    opts = opts || {};
    const {
      token,
      tokens = _.isArray(token) ? token : [token]
    } = opts;
    this._tokens = _.map(tokens, token => ({ available: true, token }));
    this._tokenMap = _.transform(this._tokens, (result, info) => result[info.token] = info, {});
    this._limit = tokens.length;
    this._locations = [];
    this._developers = [];
    this._repositories = [];
    this._closed = false;
    this._promises = [];
    this._events();
  }

  _events() {
    const errorHandler = () => {
      if (this._closed) {
        return;
      }
      console.log('closing...');
      this._closed = true;
      _.forEach(this._promises, promise => promise.cancel());
    };
    process.on('uncaughtException', errorHandler);
    process.on('SIGINT', errorHandler);
  }

  _delay() {
    const promise = Aigle.delay(DELAY);
    this._promises.push(promise);
    return promise;
  }

  _getToken() {
    const { token } = _.find(this._tokens, 'available') || {};
    if (token) {
      return Aigle.resolve(token);
    }
    console.error('waiting...');
    return this._delay()
      .then(() => this._getToken());
  }

  _disableHandler(token) {
    const info = this._tokenMap[token];
    info.available = false;
    return this._delay()
      .then(() => info.available = true);
  }

  get(query, opts) {
    if (this._closed) {
      return Aigle.reject(new CancellationError('It is already cancelled'));
    }
    let token;
    return this._getToken()
      .then(res => {
        token = res;
        return request.get(query, token, opts);
      })
      .catch(error => {
        console.error(error);
        if (!/^API rate limit/.test(error)) {
          return Aigle.reject(error);
        }
        this._disableHandler(token);
        return this.get(query, opts);
      });
  }

  /**
   * @param {string|string[]} locations
   * @param {integer} [page=1] - first location page
   */
  getDevelopers(locations, page = 1) {
    console.log('getDevelpers', `locations: [${locations}]`);
    locations = _.isString(locations) ? [locations] : locations;
    this.readDevelopers();
    const activeInfo = [];
    return Aigle.eachLimit(locations, (location, index) => {
      const info = {
        location,
        page: index === 0 ? page : 1
      };
      activeInfo.push(info);
      return Aigle.doUntil(() => {
        const opts = {
          q: `location:${location}`,
          page: info.page
        };
        console.log('getDevelpers', 'searching user...\n', opts);
        return this.get(query.users, opts)
          .then(items => {
            info.page++;
            const developers = _.map(items, 'login');
            this._developers.push(...developers);
            return developers;
          });
      }, developers => developers.length < MAXIMUM_LENGTH)
      .then(() => _.remove(activeInfo, info));
    })
    .finally(() => this.saveDevelopers())
    .catch(CancellationError, _.noop)
    .then(() => _.first(activeInfo));
  }

  /**
   * get repositories by developers
   * @param {string[]} [developers]
   */
  getRepositories(developers) {
    developers = developers || this.readDevelopers();
    if (_.isEmpty(developers)) {
      return Aigle.reject(new Error('Need to get users, first'));
    }
    this.readRepositories();
    const info = {};
    return Aigle.eachLimit(developers, this._limit, developer => {
      console.log(`checking ${developer}'s repositories...`);
      const opts = {
        q: `user:${developer} fork:false stars:>=${LOWEST_STAR}`,
        sort: 'stars'
      };
      info.developer = developer;
      return this.get(query.repositories, opts)
        .then(items => {
          const repositories = _.map(items, repo => {
            return {
              name: repo.name || '',
              owner: repo.owner,
              language: repo.language || 'Documents',
              full_name: repo.full_name,
              desc: repo.description,
              html_url: repo.html_url,
              stars: repo.stargazers_count,
              homepage: repo.homepage
            };
          });
          this._repositories.push(...repositories);
        })
        .catch(error => {
          if (/Validation Failed/.test(error)) {
            return console.error(`skip ${developer}`, error);
          }
          return Aigle.reject(error);
        });
    })
    .finally(() => this.saveRepositories())
    .catch(CancellationError, _.noop)
    .then(() => info);
  }

  /**
   * read all developers for searching repositories
   */
  readDevelopers() {
    this._developers = require(filepath.developers);
    return this._developers;
  }

  setDevelopers(developers) {
    this._developers = developers;
  }

  saveDevelopers() {
    console.log('saveDevelopers', 'saving...');
    const developers = _.chain(this._developers)
      .sortBy()
      .sortedUniq()
      .value();
    console.log('saveDevelopers', `developers: ${developers.length}`);
    fs.writeFileSync(filepath.developers, JSON.stringify(developers, null, 2), 'utf8');
  }

  /**
   * read all rankers for searching repositories
   */
  readRankers() {
    this._developers = require(filepath.rankers);
    return this._developers;
  }

  readRepositories() {
    this._repositories = require(filepath.repositories);
    return this._repositories;
  }

  saveRepositories() {
    console.log('saveRepositories', 'saving...');
    const repositories = _.chain(this._repositories)
      .reverse()
      .uniqWith((a, b) => _.isEqual(a.owner.login, b.owner.login) && _.isEqual(a.name, b.name))
      .sortBy(['owner.login', 'name'])
      .value();
    console.log('saveRepositories', `repositories: ${repositories.length}`);
    fs.writeFileSync(filepath.repositories, JSON.stringify(repositories, null, 2), 'utf8');
  }
}

module.exports = MadeIn;
