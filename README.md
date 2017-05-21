# Made-In-Generator

The repository is inspired by [@IonicaBizau/made-in](https://github.com/IonicaBizau/made-in).

It supports getting developers and repositories on github and making documantation.

## Usage

```sh
$ npm install --save-dev made-in-generator
```

## Functions

### Searching Developers

```js
const { MadeIn } = require('made-in-generator');
const token = ''; // github auth token
const locations = ['Japan', 'Tokyo']; // It is used for seaching location, you should use a country and cities
return new MadeIn({ token })
  .getDevelopers(locations);  // It creates `data/developers.json`
```

### Searching Repositories

```js
const { MadeIn } = require('made-in-generator');
const token = ''; // github auth token
const developers = require('./data/developers.json');
return new MadeIn({ token })
  .getRepositories(developers); // It creates `data/repositories.json`
```

### Making documantations

```sh
$ npm init
```

The `package.json` has to have `homepage`. It will be used for documentation links.

```js
const { makeDocs } = require('made-in-generator');
const repositories = require('./data/repositories.json');
makeDocs(repositories);
```

## Links

- [`made-in-japan`](https://github.com/suguru03/made-in-japan)
- [`made-in-canada`](https://github.com/suguru03/made-in-canada)
